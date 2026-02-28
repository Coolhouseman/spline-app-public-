import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { AppState } from 'react-native';
import { User } from '@/shared/types';
import { AuthService, SignupData } from '@/services/auth.service';
import { generateUniqueId } from '@/utils/storage';
import { supabase } from '@/services/supabase';

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
  const userSetBySignup = useRef(false);
  const instanceId = useRef(Date.now());
  const STARTUP_AUTH_TIMEOUT_MS = 8000;
  const SIGNUP_STALE_TIMEOUT_MS = 20000;
  const SIGNUP_APPSTATE_STALE_MS = 15000;
  const signupInProgressRef = useRef(false);
  const signupStartedAtRef = useRef<number | null>(null);
  const signupWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousUiStateRef = useRef<string | null>(null);

  const clearSignupWatchdog = () => {
    if (signupWatchdogRef.current) {
      clearTimeout(signupWatchdogRef.current);
      signupWatchdogRef.current = null;
    }
  };

  const endSignupFlow = (reason: string) => {
    clearSignupWatchdog();
    signupInProgressRef.current = false;
    signupStartedAtRef.current = null;
    setIsSigningUp(false);
    console.log(`[Auth] signup_flow_end reason=${reason}`);
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
      endSignupFlow('watchdog_timeout');
    }, SIGNUP_STALE_TIMEOUT_MS);
    console.log(`[Auth] signup_flow_start reason=${reason}`);
  };

  useEffect(() => {
    console.log(`[AuthProvider ${instanceId.current}] Mounted`);
    loadUser();
    
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] State changed:', event, 'signupInProgress:', signupInProgressRef.current, 'userSetBySignup:', userSetBySignup.current);
      
      // Skip ALL auth state changes during active signup
      if (signupInProgressRef.current) {
        console.log('[Auth] Skipping - signup in progress');
        return;
      }
      
      // For SIGNED_OUT, verify there's actually no session before clearing user
      if (event === 'SIGNED_OUT') {
        if (userSetBySignup.current) {
          console.log('[Auth] SIGNED_OUT but userSetBySignup is true, verifying session...');
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession?.user) {
            console.log('[Auth] Session still valid, ignoring spurious SIGNED_OUT');
            return;
          }
        }
        console.log('[Auth] Processing SIGNED_OUT - clearing user');
        setUser(null);
        userSetBySignup.current = false;
      } else if (event === 'SIGNED_IN' && session?.user) {
        if (userSetBySignup.current) {
          console.log('[Auth] Skipping SIGNED_IN - user already set by signup');
          return;
        }
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (profile) {
          // Check if profile is complete (has phone and DOB)
          const isProfileComplete = Boolean(profile.phone && profile.date_of_birth);
          if (!isProfileComplete) {
            console.log('[Auth] Profile incomplete (missing phone/DOB), not setting user - needs profile completion');
            return;
          }
          setUser(profile as User);
        }
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (profile) {
          // Check if profile is complete (has phone and DOB)
          const isProfileComplete = Boolean(profile.phone && profile.date_of_birth);
          if (!isProfileComplete) {
            console.log('[Auth] Profile incomplete on token refresh, not updating user');
            return;
          }
          setUser(profile as User);
        }
      }
    });

    return () => {
      console.log(`[AuthProvider ${instanceId.current}] Unmounting`);
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
      subscription.remove();
    };
  }, []);

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
    const startupStartedAt = Date.now();
    const HARD_STARTUP_UNLOCK_MS = 12000;
    const hardUnlockTimer = setTimeout(() => {
      console.warn(
        `[AuthProvider ${instanceId.current}] Force-unlocking startup UI after ${HARD_STARTUP_UNLOCK_MS}ms`
      );
      setIsLoading(false);
    }, HARD_STARTUP_UNLOCK_MS);

    try {
      console.log(`[AuthProvider ${instanceId.current}] Loading user...`);
      const restorePromise = AuthService.restoreSession();
      const session = await Promise.race([
        restorePromise,
        new Promise<null>((resolve) =>
          setTimeout(() => {
            console.warn(
              `[AuthProvider ${instanceId.current}] Startup auth timed out after ${STARTUP_AUTH_TIMEOUT_MS}ms`
            );
            resolve(null);
          }, STARTUP_AUTH_TIMEOUT_MS)
        ),
      ]);

      if (session) {
        console.log(
          `[AuthProvider ${instanceId.current}] Restored user in ${Date.now() - startupStartedAt}ms:`,
          session.user.id
        );
        setUser(session.user);
      } else {
        console.log(
          `[AuthProvider ${instanceId.current}] No session restored during startup after ${Date.now() - startupStartedAt}ms`
        );
        // Keep listening for a late session resolution after initial UI unlock.
        void restorePromise
          .then((lateSession) => {
            if (lateSession?.user) {
              console.log(
                `[AuthProvider ${instanceId.current}] Restored user after timeout in ${Date.now() - startupStartedAt}ms:`,
                lateSession.user.id
              );
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
      clearTimeout(hardUnlockTimer);
      // Never block first paint forever waiting on auth/network.
      console.log(
        `[AuthProvider ${instanceId.current}] Startup auth path finished in ${Date.now() - startupStartedAt}ms`
      );
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const { user: loggedInUser } = await AuthService.login(email, password);
      setUser(loggedInUser);
      return true;
    } catch (error) {
      console.error('Login failed:', error);
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
