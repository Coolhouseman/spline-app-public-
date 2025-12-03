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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isSigningUp = useRef(false);

  useEffect(() => {
    loadUser();
    
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, 'isSigningUp:', isSigningUp.current);
      
      // Skip auth state changes during active signup - signup() will set user directly
      if (isSigningUp.current) {
        console.log('Skipping auth state change during signup');
        return;
      }
      
      if (event === 'SIGNED_IN' && session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (profile) {
          setUser(profile as User);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
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
      // Set flag to prevent auth state listener from interfering
      isSigningUp.current = true;
      console.log('Starting signup, setting isSigningUp flag');
      
      const { user: newUser } = await AuthService.signup(userData);
      console.log('Signup complete, setting user:', newUser.id);
      setUser(newUser);
      
      // Clear the flag after user is set
      isSigningUp.current = false;
      console.log('Cleared isSigningUp flag');
      
      return newUser.unique_id;
    } catch (error) {
      // Always clear the flag on error
      isSigningUp.current = false;
      console.error('Signup failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await AuthService.logout();
      setUser(null);
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
