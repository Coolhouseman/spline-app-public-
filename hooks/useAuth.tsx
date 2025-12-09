import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
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

// Global flag to track signup state (survives re-renders and closures)
let globalIsSigningUp = false;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const userSetBySignup = useRef(false);
  const instanceId = useRef(Date.now());

  useEffect(() => {
    console.log(`[AuthProvider ${instanceId.current}] Mounted`);
    loadUser();
    
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] State changed:', event, 'globalIsSigningUp:', globalIsSigningUp, 'userSetBySignup:', userSetBySignup.current);
      
      // Skip ALL auth state changes during active signup
      if (globalIsSigningUp) {
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
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const loadUser = async () => {
    try {
      console.log(`[AuthProvider ${instanceId.current}] Loading user...`);
      const session = await AuthService.restoreSession();
      if (session) {
        console.log(`[AuthProvider ${instanceId.current}] Restored user:`, session.user.id);
        setUser(session.user);
      } else {
        console.log(`[AuthProvider ${instanceId.current}] No session found`);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    } finally {
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
    try {
      // Set flags to prevent auth state listener from interfering and show loading
      globalIsSigningUp = true;
      setIsSigningUp(true);
      console.log('[Signup] Starting, setting globalIsSigningUp flag');
      
      const { user: newUser } = await AuthService.signup(userData);
      console.log('[Signup] Complete, setting user:', newUser.id);
      
      // Mark that user was set by signup (prevents auth listener from overriding)
      userSetBySignup.current = true;
      setUser(newUser);
      setIsLoading(false);
      console.log('[Signup] User state updated, userSetBySignup is now true');
      
      // Clear isSigningUp AFTER user is set - this triggers navigation
      setIsSigningUp(false);
      
      // Defer clearing globalIsSigningUp to allow any pending auth events to be skipped
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify session is stable before clearing the flag
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id === newUser.id) {
        console.log('[Signup] Session verified stable, clearing globalIsSigningUp flag');
        globalIsSigningUp = false;
      } else {
        console.log('[Signup] Session mismatch, keeping flag for safety');
        setTimeout(() => { globalIsSigningUp = false; }, 2000);
      }
      
      return newUser.unique_id;
    } catch (error) {
      globalIsSigningUp = false;
      setIsSigningUp(false);
      userSetBySignup.current = false;
      console.error('Signup failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Set user to null first to immediately update UI
      setUser(null);
      userSetBySignup.current = false;
      globalIsSigningUp = false;
      
      // Then sign out from Supabase (this might be slow or fail, but UI is already updated)
      await AuthService.logout();
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if signOut fails, ensure user state is cleared
      setUser(null);
      userSetBySignup.current = false;
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
          globalIsSigningUp = false;
          setIsSigningUp(false);
          setUser(profile as User);
        }
      }
    } catch (error) {
      console.error('Refresh user failed:', error);
    }
  };

  const setSocialSignupInProgress = (inProgress: boolean) => {
    console.log('[Auth] setSocialSignupInProgress:', inProgress);
    globalIsSigningUp = inProgress;
    setIsSigningUp(inProgress);
  };

  const clearSignupOverlay = () => {
    console.log('[Auth] clearSignupOverlay - hiding loading but keeping auth listener blocked');
    setIsSigningUp(false);
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
