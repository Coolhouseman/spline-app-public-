import { supabase } from './supabase';
import type { User } from '@/shared/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SignupData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  dateOfBirth?: string;
  bio?: string;
  uniqueId: string;
}

export class AuthService {
  static async signup(data: SignupData): Promise<{ user: User; session: any }> {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          name: data.name,
          unique_id: data.uniqueId,
          phone: data.phone,
          date_of_birth: data.dateOfBirth,
          bio: data.bio,
        },
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('User creation failed');

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        unique_id: data.uniqueId,
        name: data.name,
        email: data.email,
        phone: data.phone,
        date_of_birth: data.dateOfBirth,
        bio: data.bio,
      })
      .select()
      .single();

    if (profileError) throw profileError;

    const { error: walletError } = await supabase
      .from('wallets')
      .insert({
        user_id: authData.user.id,
        balance: 0,
        bank_connected: false,
      });

    if (walletError) throw walletError;

    await AsyncStorage.setItem('supabase_session', JSON.stringify(authData.session));

    return { user: profile as User, session: authData.session };
  }

  static async login(email: string, password: string): Promise<{ user: User; session: any }> {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Login failed');

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError) throw profileError;

    await AsyncStorage.setItem('supabase_session', JSON.stringify(authData.session));

    return { user: profile as User, session: authData.session };
  }

  static async logout(): Promise<void> {
    await supabase.auth.signOut();
    await AsyncStorage.removeItem('supabase_session');
    await AsyncStorage.removeItem('currentUser');
  }

  static async getCurrentUser(): Promise<User | null> {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    
    if (!authUser) return null;

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    return profile as User;
  }

  static async restoreSession(): Promise<{ user: User; session: any } | null> {
    try {
      const sessionStr = await AsyncStorage.getItem('supabase_session');
      if (!sessionStr) return null;

      const session = JSON.parse(sessionStr);
      const { data, error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });

      if (error || !data.user) return null;

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (!profile) return null;

      return { user: profile as User, session: data.session };
    } catch (error) {
      console.error('Session restore failed:', error);
      return null;
    }
  }

  static async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return data as User;
  }

  static async uploadProfilePicture(userId: string, fileUri: string): Promise<string> {
    const response = await fetch(fileUri);
    const blob = await response.blob();
    const fileExt = fileUri.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `profile-pictures/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('user-uploads')
      .upload(filePath, blob, {
        contentType: `image/${fileExt}`,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('user-uploads')
      .getPublicUrl(filePath);

    await this.updateProfile(userId, { profile_picture: publicUrl });

    return publicUrl;
  }
}
