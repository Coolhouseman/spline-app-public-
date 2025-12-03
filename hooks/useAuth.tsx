import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User } from '@/shared/types';
import { AuthService, SignupData } from '@/services/auth.service';
import { generateUniqueId } from '@/utils/storage';
import { supabase } from '@/services/supabase';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (userData: SignupData) => Promise<string>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Global flag to track signup state (survives re-renders and closures)
let globalIsSigningUp = false;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserInternal] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, forceUpdate] = useState(0);
  const userSetBySignup = useRef(false);
  const userRef = useRef<User | null>(null);

  // Wrapper to log and ensure state changes propagate
  const setUser = (newUser: User | null) => {
    console.log('setUser called with:', newUser ? newUser.id : 'null');
    userRef.current = newUser;
    setUserInternal(newUser);
    // Force a re-render to ensure context consumers update
    forceUpdate(n => n + 1);
  };

  useEffect(() => {
    loadUser();
    
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, 'globalIsSigningUp:', globalIsSigningUp, 'userSetBySignup:', userSetBySignup.current);
      
      // Skip ALL auth state changes during active signup
      if (globalIsSigningUp) {
        console.log('Skipping auth state change - signup in progress');
        return;
      }
      
      // For SIGNED_OUT, verify there's actually no session before clearing user
      // Supabase can emit spurious SIGNED_OUT during RPC/storage operations
      if (event === 'SIGNED_OUT') {
        // If user was just set by signup, verify with Supabase before clearing
        if (userSetBySignup.current) {
          console.log('SIGNED_OUT received but userSetBySignup is true, verifying session...');
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession?.user) {
            console.log('Session still valid, ignoring spurious SIGNED_OUT');
            return;
          }
        }
        console.log('Processing SIGNED_OUT - clearing user');
        setUser(null);
        userSetBySignup.current = false;
      } else if (event === 'SIGNED_IN' && session?.user) {
        // Skip if user was already set by signup
        if (userSetBySignup.current) {
          console.log('Skipping SIGNED_IN - user already set by signup');
          return;
        }
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (profile) {
          setUser(profile as User);
        }
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (profile) {
          setUser(profile as User);
        }
      }
      // Ignore INITIAL_SESSION - it can fire during uploads and cause issues
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const loadUser = async () => {
    try {
      const session = await AuthService.restoreSession();
      if (session) {
        setUser(session.user);
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
      // Set global flag to prevent auth state listener from interfering
      globalIsSigningUp = true;
      console.log('Starting signup, setting globalIsSigningUp flag');
      
      const { user: newUser } = await AuthService.signup(userData);
      console.log('Signup complete, setting user:', newUser.id);
      
      // Mark that user was set by signup (prevents auth listener from overriding)
      userSetBySignup.current = true;
      setUser(newUser);
      console.log('User state updated, userSetBySignup is now true');
      
      // Defer clearing globalIsSigningUp to allow any pending auth events to be skipped
      // This prevents race conditions with Supabase's auth state changes
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify session is stable before clearing the flag
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id === newUser.id) {
        console.log('Session verified stable, clearing globalIsSigningUp flag');
        globalIsSigningUp = false;
      } else {
        console.log('Session mismatch, keeping globalIsSigningUp flag for safety');
        // Still clear it eventually to prevent getting stuck
        setTimeout(() => { globalIsSigningUp = false; }, 2000);
      }
      
      return newUser.unique_id;
    } catch (error) {
      // Always clear the flags on error
      globalIsSigningUp = false;
      userSetBySignup.current = false;
      console.error('Signup failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await AuthService.logout();
      setUser(null);
      userSetBySignup.current = false;
    } catch (error) {
      console.error('Logout failed:', error);
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
    if (user) {
      try {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          setUser(profile as User);
        }
      } catch (error) {
        console.error('Refresh user failed:', error);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout, updateUser, refreshUser }}>
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
