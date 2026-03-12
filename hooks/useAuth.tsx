import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { AppState } from 'react-native';
import { User } from '@/shared/types';
import { AuthService, SignupData } from '@/services/auth.service';
import { generateUniqueId } from '@/utils/storage';
import { logDiagnosticEvent } from '@/services/diagnostics.service';
import { supabase, activateAutoRefresh } from '@/services/supabase';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isSigningUp: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (userData: SignupData) => Promise<string>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
  setSocialSignupInProgress: (inProgress: boolean) => void;
  clearSignupOverlay: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const isMountedRef = useRef(true);
  const userSetBySignup = useRef(false);
  const instanceId = useRef(Date.now());
  const STARTUP_AUTH_TIMEOUT_MS = 8000;
  const SIGNUP_STALE_TIMEOUT_MS = 20000;
  const SIGNUP_APPSTATE_STALE_MS = 15000;
  const signupInProgressRef = useRef(false);
  const signupStartedAtRef = useRef<number | null>(null);
  const signupWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousUiStateRef = useRef<string | null>(null);
  const isLoadingRef = useRef(true);
  const startupRecoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreGenerationRef = useRef(0);
  const restoreInFlightRef = useRef(false);
  const STARTUP_ACTIVE_RECOVERY_DELAY_MS = 3000;
  const STARTUP_ACTIVE_RECOVERY_TIMEOUT_MS = 6000;

  const clearSignupWatchdog = () => {
    if (signupWatchdogRef.current) {
      clearTimeout(signupWatchdogRef.current);
      signupWatchdogRef.current = null;
    }
  };

  const clearStartupRecoveryTimer = () => {
    if (startupRecoveryTimerRef.current) {
      clearTimeout(startupRecoveryTimerRef.current);
      startupRecoveryTimerRef.current = null;
    }
  };

  const endSignupFlow = (reason: string) => {
    clearSignupWatchdog();
    signupInProgressRef.current = false;
    signupStartedAtRef.current = null;
    setIsSigningUp(false);
    console.log(`[Auth] signup_flow_end reason=${reason}`);
    void logDiagnosticEvent('auth_signup_flow_end', { reason });
  };

  const beginSignupFlow = (reason: string) => {
    clearSignupWatchdog();
    signupInProgressRef.current = true;
    signupStartedAtRef.current = Date.now();
    setIsSigningUp(true);
    signupWatchdogRef.current = setTimeout(() => {
      console.warn(
        `[Auth] signup_flow_watchdog_timeout elapsed_ms=${SIGNUP_STALE_TIMEOUT_MS} reason=auto_clear`
      );
      void logDiagnosticEvent('auth_signup_watchdog_timeout', {
        timeoutMs: SIGNUP_STALE_TIMEOUT_MS,
      });
      endSignupFlow('watchdog_timeout');
    }, SIGNUP_STALE_TIMEOUT_MS);
    console.log(`[Auth] signup_flow_start reason=${reason}`);
    void logDiagnosticEvent('auth_signup_flow_start', { reason });
  };

  const processAuthStateChange = async (event: string, session: any) => {
    const authStateStartedAt = Date.now();
    console.log(
      '[Auth] State changed:',
      event,
      'signupInProgress:',
      signupInProgressRef.current,
      'userSetBySignup:',
      userSetBySignup.current
    );
    void logDiagnosticEvent('auth_state_change_received', {
      event,
      hasSessionUser: Boolean(session?.user),
      signupInProgress: signupInProgressRef.current,
      userSetBySignup: userSetBySignup.current,
    });

    if (!isMountedRef.current) {
      void logDiagnosticEvent('auth_state_change_ignored_unmounted', { event });
      return;
    }

    // Skip ALL auth state changes during active signup
    if (signupInProgressRef.current) {
      console.log('[Auth] Skipping - signup in progress');
      void logDiagnosticEvent('auth_state_change_skipped_signup', { event });
      return;
    }

    // For SIGNED_OUT, verify there's actually no session before clearing user
    if (event === 'SIGNED_OUT') {
      if (userSetBySignup.current) {
        console.log('[Auth] SIGNED_OUT but userSetBySignup is true, verifying session...');
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession?.user) {
          console.log('[Auth] Session still valid, ignoring spurious SIGNED_OUT');
          void logDiagnosticEvent('auth_state_change_signed_out_ignored_valid_session', {
            elapsedMs: Date.now() - authStateStartedAt,
          });
          return;
        }
      }
      console.log('[Auth] Processing SIGNED_OUT - clearing user');
      if (!isMountedRef.current) {
        void logDiagnosticEvent('auth_state_change_ignored_unmounted', { event, phase: 'signed_out' });
        return;
      }
      setUser(null);
      userSetBySignup.current = false;
      void logDiagnosticEvent('auth_state_change_signed_out_applied', {
        elapsedMs: Date.now() - authStateStartedAt,
      });
      return;
    }

    if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
      if (event === 'SIGNED_IN' && userSetBySignup.current) {
        console.log('[Auth] Skipping SIGNED_IN - user already set by signup');
        void logDiagnosticEvent('auth_state_change_skipped_user_set_by_signup', { event });
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (!profile) {
        void logDiagnosticEvent('auth_state_change_profile_missing', {
          event,
          elapsedMs: Date.now() - authStateStartedAt,
        });
        return;
      }

      const isProfileComplete = Boolean(profile.phone && profile.date_of_birth);
      if (!isProfileComplete) {
        if (event === 'SIGNED_IN') {
          console.log('[Auth] Profile incomplete (missing phone/DOB), not setting user - needs profile completion');
        } else {
          console.log('[Auth] Profile incomplete on token refresh, not updating user');
        }
        void logDiagnosticEvent('auth_state_change_profile_incomplete', {
          event,
          elapsedMs: Date.now() - authStateStartedAt,
        });
        return;
      }

      if (!isMountedRef.current) {
        void logDiagnosticEvent('auth_state_change_ignored_unmounted', { event, phase: 'set_user' });
        return;
      }
      setUser(profile as User);
      void logDiagnosticEvent('auth_state_change_user_applied', {
        event,
        elapsedMs: Date.now() - authStateStartedAt,
      });
    }
  };

  useEffect(() => {
    console.log(`[AuthProvider ${instanceId.current}] Mounted`);
    isMountedRef.current = true;
    loadUser();
    
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setTimeout(() => {
        void processAuthStateChange(event, session).catch((error) => {
          console.error('[Auth] Auth state handler failed:', error);
          void logDiagnosticEvent('auth_state_change_handler_error', {
            event,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }, 0);
    });

    return () => {
      console.log(`[AuthProvider ${instanceId.current}] Unmounting`);
      isMountedRef.current = false;
      clearSignupWatchdog();
      signupInProgressRef.current = false;
      signupStartedAtRef.current = null;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState !== 'active') {
        return;
      }

      if (isLoadingRef.current) {
        clearStartupRecoveryTimer();

        if (restoreInFlightRef.current) {
          console.log('[Auth] startup_active_recovery_skipped reason=restore_in_flight');
          void logDiagnosticEvent('auth_restore_skipped_inflight', { reason: 'active_recovery' });
        } else {
          startupRecoveryTimerRef.current = setTimeout(async () => {
            if (!isLoadingRef.current) {
              return;
            }
            if (restoreInFlightRef.current) {
              console.log('[Auth] startup_active_recovery_skipped_at_fire reason=restore_in_flight');
              void logDiagnosticEvent('auth_restore_skipped_inflight', { reason: 'active_recovery_at_fire' });
              return;
            }

            const generation = ++restoreGenerationRef.current;
            restoreInFlightRef.current = true;
            console.warn(
              `[Auth] startup_active_recovery_begin delay_ms=${STARTUP_ACTIVE_RECOVERY_DELAY_MS} generation=${generation}`
            );
            void logDiagnosticEvent('auth_startup_active_recovery_begin', {
              delayMs: STARTUP_ACTIVE_RECOVERY_DELAY_MS,
              generation,
            });
            try {
              let activeRecoveryTimeoutId: ReturnType<typeof setTimeout> | null = null;
              const recoveredSession = await Promise.race([
                AuthService.restoreSession(),
                new Promise<null>((resolve) =>
                  (activeRecoveryTimeoutId = setTimeout(() => {
                    console.warn(
                      `[Auth] startup_active_recovery_timeout timeout_ms=${STARTUP_ACTIVE_RECOVERY_TIMEOUT_MS}`
                    );
                    void logDiagnosticEvent('auth_startup_active_recovery_timeout', {
                      timeoutMs: STARTUP_ACTIVE_RECOVERY_TIMEOUT_MS,
                    });
                    resolve(null);
                  }, STARTUP_ACTIVE_RECOVERY_TIMEOUT_MS))
                ),
              ]);
              if (activeRecoveryTimeoutId) {
                clearTimeout(activeRecoveryTimeoutId);
              }

              if (generation !== restoreGenerationRef.current) {
                console.log(`[Auth] active_recovery_stale_ignored generation=${generation} current=${restoreGenerationRef.current}`);
                void logDiagnosticEvent('auth_restore_stale_ignored', { generation, current: restoreGenerationRef.current, source: 'active_recovery' });
                return;
              }

              if (recoveredSession?.user) {
                console.log('[Auth] startup_active_recovery_success user_id=', recoveredSession.user.id);
                void logDiagnosticEvent('auth_startup_active_recovery_success', { hasUser: true });
                setUser(recoveredSession.user);
              } else {
                console.log('[Auth] startup_active_recovery_no_session forcing_ui_unlock=true');
                void logDiagnosticEvent('auth_startup_active_recovery_empty', { hasUser: false });
              }
            } catch (error) {
              console.error('[Auth] startup_active_recovery_error:', error);
              void logDiagnosticEvent('auth_startup_active_recovery_error', {
                error: error instanceof Error ? error.message : String(error),
              });
            } finally {
              if (generation === restoreGenerationRef.current) {
                restoreInFlightRef.current = false;
              }
              setIsLoading(false);
            }
          }, STARTUP_ACTIVE_RECOVERY_DELAY_MS);
        }
      }

      if (!signupInProgressRef.current) {
        return;
      }

      const startedAt = signupStartedAtRef.current;
      const elapsed = startedAt ? Date.now() - startedAt : 0;
      if (elapsed >= SIGNUP_APPSTATE_STALE_MS) {
        console.warn(
          `[Auth] appstate_active_detected_stale_signup elapsed_ms=${elapsed} action=clear_signup_flow`
        );
        endSignupFlow('appstate_stale_recovery');
      } else {
        console.log(`[Auth] appstate_active_signup_still_fresh elapsed_ms=${elapsed}`);
      }
    });

    return () => {
      clearStartupRecoveryTimer();
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    isLoadingRef.current = isLoading;
    if (!isLoading) {
      clearStartupRecoveryTimer();
    }
  }, [isLoading]);

  useEffect(() => {
    const uiState = [
      `isLoading=${isLoading}`,
      `isSigningUp=${isSigningUp}`,
      `hasUser=${Boolean(user)}`,
      `signupInProgressRef=${signupInProgressRef.current}`,
    ].join(' ');

    if (previousUiStateRef.current !== uiState) {
      console.log(`[Auth] ui_state_transition prev="${previousUiStateRef.current}" next="${uiState}"`);
      previousUiStateRef.current = uiState;
    }
  }, [isLoading, isSigningUp, user]);

  const loadUser = async () => {
    const generation = ++restoreGenerationRef.current;
    restoreInFlightRef.current = true;
    const startupStartedAt = Date.now();
    const HARD_STARTUP_UNLOCK_MS = 12000;
    const hardUnlockTimer = setTimeout(() => {
      console.warn(
        `[AuthProvider ${instanceId.current}] Force-unlocking startup UI after ${HARD_STARTUP_UNLOCK_MS}ms`
      );
      void logDiagnosticEvent('auth_hard_startup_unlock', { timeoutMs: HARD_STARTUP_UNLOCK_MS });
      setIsLoading(false);
    }, HARD_STARTUP_UNLOCK_MS);

    try {
      console.log(`[AuthProvider ${instanceId.current}] Loading user... generation=${generation}`);
      const restorePromise = AuthService.restoreSession();
      let startupTimeoutId: ReturnType<typeof setTimeout> | null = null;
      const session = await Promise.race([
        restorePromise,
        new Promise<null>((resolve) =>
          (startupTimeoutId = setTimeout(() => {
            console.warn(
              `[AuthProvider ${instanceId.current}] Startup auth timed out after ${STARTUP_AUTH_TIMEOUT_MS}ms`
            );
            void logDiagnosticEvent('auth_startup_timeout', {
              timeoutMs: STARTUP_AUTH_TIMEOUT_MS,
            });
            resolve(null);
          }, STARTUP_AUTH_TIMEOUT_MS))
        ),
      ]);
      if (startupTimeoutId) {
        clearTimeout(startupTimeoutId);
      }

      if (generation !== restoreGenerationRef.current) {
        console.log(`[Auth] restore_stale_ignored generation=${generation} current=${restoreGenerationRef.current}`);
        void logDiagnosticEvent('auth_restore_stale_ignored', { generation, current: restoreGenerationRef.current });
        return;
      }

      if (session) {
        console.log(
          `[AuthProvider ${instanceId.current}] Restored user in ${Date.now() - startupStartedAt}ms:`,
          session.user.id
        );
        void logDiagnosticEvent('auth_startup_restore_success', {
          elapsedMs: Date.now() - startupStartedAt,
        });
        setUser(session.user);
      } else {
        console.log(
          `[AuthProvider ${instanceId.current}] No session restored during startup after ${Date.now() - startupStartedAt}ms`
        );
        void logDiagnosticEvent('auth_startup_restore_empty', {
          elapsedMs: Date.now() - startupStartedAt,
        });
        void restorePromise
          .then((lateSession) => {
            if (generation !== restoreGenerationRef.current) {
              console.log(`[Auth] late_restore_stale_ignored generation=${generation} current=${restoreGenerationRef.current}`);
              void logDiagnosticEvent('auth_late_restore_stale_ignored', { generation, current: restoreGenerationRef.current });
              return;
            }
            if (lateSession?.user) {
              console.log(
                `[AuthProvider ${instanceId.current}] Restored user after timeout in ${Date.now() - startupStartedAt}ms:`,
                lateSession.user.id
              );
              void logDiagnosticEvent('auth_startup_restore_late_success', {
                elapsedMs: Date.now() - startupStartedAt,
              });
              setUser(lateSession.user);
            }
          })
          .catch((lateError) => {
            console.error('[Auth] Late session restore failed:', lateError);
          });
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
      if (generation === restoreGenerationRef.current) {
        restoreInFlightRef.current = false;
      }
      clearTimeout(hardUnlockTimer);
      console.log(
        `[AuthProvider ${instanceId.current}] Startup auth path finished in ${Date.now() - startupStartedAt}ms generation=${generation}`
      );
      setIsLoading(false);
      activateAutoRefresh();
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    void logDiagnosticEvent('auth_password_login_begin');
    try {
      const { user: loggedInUser } = await AuthService.login(email, password);
      setUser(loggedInUser);
      void logDiagnosticEvent('auth_password_login_success');
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      void logDiagnosticEvent('auth_password_login_failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  };

  const signup = async (userData: SignupData): Promise<string> => {
    beginSignupFlow('email_signup');
    try {
      const { user: newUser } = await AuthService.signup(userData);
      console.log('[Signup] Complete, setting user:', newUser.id);
      
      // Mark that user was set by signup (prevents auth listener from overriding)
      userSetBySignup.current = true;
      setUser(newUser);
      setIsLoading(false);
      console.log('[Signup] User state updated, userSetBySignup is now true');
      endSignupFlow('email_signup_success');
      
      return newUser.unique_id;
    } catch (error) {
      endSignupFlow('email_signup_error');
      userSetBySignup.current = false;
      console.error('Signup failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    console.log('[Auth] Logout called');
    try {
      // Set user to null first to immediately update UI
      setUser(null);
      userSetBySignup.current = false;
      endSignupFlow('logout');
      
      // Then sign out from Supabase with a timeout (this might be slow or fail, but UI is already updated)
      // Attach .catch() to prevent unhandled rejection if promise rejects after timeout
      const signOutPromise = AuthService.logout().catch((err) => {
        console.log('[Auth] Logout promise rejected (handled):', err);
      });
      const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 3000));
      await Promise.race([signOutPromise, timeoutPromise]);
      console.log('[Auth] Logout completed');
    } catch (error) {
      console.error('[Auth] Logout failed:', error);
      // Even if signOut fails, ensure user state is cleared
      setUser(null);
      userSetBySignup.current = false;
      endSignupFlow('logout_error_recovery');
    }
  };

  const updateUser = async (updates: Partial<User>) => {
    if (user) {
      try {
        const updatedUser = await AuthService.updateProfile(user.id, updates);
        setUser(updatedUser);
      } catch (error) {
        console.error('Update user failed:', error);
        throw error;
      }
    }
  };

  const refreshUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (profile) {
          userSetBySignup.current = true;
          endSignupFlow('refresh_user');
          setUser(profile as User);
        }
      }
    } catch (error) {
      console.error('Refresh user failed:', error);
    }
  };

  const setSocialSignupInProgress = (inProgress: boolean) => {
    console.log('[Auth] setSocialSignupInProgress:', inProgress);
    if (inProgress) {
      beginSignupFlow('social_auth');
    } else {
      endSignupFlow('social_auth_complete');
    }
  };

  const clearSignupOverlay = () => {
    console.log('[Auth] clearSignupOverlay - clearing signup overlay and flow flags');
    endSignupFlow('clear_signup_overlay');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, isSigningUp, login, signup, logout, updateUser, refreshUser, setSocialSignupInProgress, clearSignupOverlay }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
