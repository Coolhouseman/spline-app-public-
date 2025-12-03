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
  const userSetBySignup = useRef(false);

  // Wrapper to log all user state changes
  const setUser = (newUser: User | null) => {
    console.log('setUser called with:', newUser ? newUser.id : 'null');
    setUserInternal(newUser);
  };

  useEffect(() => {
    loadUser();
    
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, 'globalIsSigningUp:', globalIsSigningUp, 'userSetBySignup:', userSetBySignup.current);
      
      // Skip ALL auth state changes during active signup or if user was just set by signup
      if (globalIsSigningUp || userSetBySignup.current) {
        console.log('Skipping auth state change - signup in progress or just completed');
        return;
      }
      
      // Only handle SIGNED_OUT - never override user set by signup/login
      if (event === 'SIGNED_OUT') {
        setUser(null);
        userSetBySignup.current = false;
      } else if (event === 'SIGNED_IN' && session?.user) {
        // Only fetch profile on SIGNED_IN if user is null (not set by signup/login)
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
      
      // Clear the global flag after user is set
      globalIsSigningUp = false;
      console.log('Cleared globalIsSigningUp flag, userSetBySignup is now true');
      
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
