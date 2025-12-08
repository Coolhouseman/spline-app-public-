import { supabase } from './supabase';
import type { User } from '@/shared/types';
import { GamificationService } from './gamification.service';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { decode } from 'base64-arraybuffer';

export interface SignupData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  dateOfBirth?: string;
  bio?: string;
  uniqueId: string;
  profilePicture?: string;
}

export class AuthService {
  static async signup(data: SignupData): Promise<{ user: User; session: any }> {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: undefined,
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

    if (!authData.session) {
      throw new Error('Email confirmation required. Please check your email and confirm your account before logging in.');
    }

    // Upload profile picture FIRST (before creating profile) to include in initial INSERT
    // This avoids RLS UPDATE issues during signup
    let profilePictureUrl: string | null = null;
    if (data.profilePicture) {
      console.log('Profile picture provided, uploading before profile creation...');
      console.log('Profile picture URI:', data.profilePicture.substring(0, 100) + '...');
      try {
        profilePictureUrl = await this.uploadProfilePictureToStorage(authData.user.id, data.profilePicture);
        console.log('Profile picture uploaded to storage:', profilePictureUrl);
      } catch (uploadError: any) {
        console.error('Profile picture upload failed during signup:', uploadError);
        console.error('Upload error details:', JSON.stringify(uploadError, null, 2));
        // Continue with signup even if picture upload fails
      }
    } else {
      console.log('No profile picture provided in signup data');
    }

    // Use SECURITY DEFINER functions to bypass RLS for user/wallet creation
    console.log('Creating user profile with ID:', authData.user.id);
    const { data: profileData, error: profileError } = await supabase
      .rpc('create_user_profile', {
        user_id: authData.user.id,
        user_unique_id: data.uniqueId,
        user_name: data.name,
        user_email: data.email,
        user_phone: data.phone || null,
        user_dob: data.dateOfBirth || null,
        user_bio: data.bio || null,
        user_profile_picture: profilePictureUrl,
      });

    if (profileError) {
      console.error('Failed to create user profile:', JSON.stringify(profileError));
      throw profileError;
    }
    
    const profile = Array.isArray(profileData) ? profileData[0] : profileData;
    if (!profile) {
      throw new Error('Failed to create user profile - no data returned');
    }
    console.log('User profile created successfully:', profile.id);

    console.log('Creating wallet for user:', authData.user.id);
    const { error: walletError } = await supabase
      .rpc('create_user_wallet', {
        p_user_id: authData.user.id,
      });

    if (walletError) {
      console.error('Failed to create wallet:', JSON.stringify(walletError));
      throw walletError;
    }
    console.log('Wallet created successfully');

    // Initialize gamification profile
    try {
      await GamificationService.initializeUser(authData.user.id);
      console.log('Gamification profile initialized');
    } catch (gamificationError) {
      console.error('Failed to initialize gamification (non-blocking):', gamificationError);
    }

    return { user: profile as User, session: authData.session };
  }

  static async login(email: string, password: string): Promise<{ user: User; session: any }> {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Login failed');

    // Try to get existing profile
    let { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    // If profile doesn't exist, create it from auth metadata using RPC
    if (profileError && profileError.code === 'PGRST116') {
      console.log('Profile not found, creating from auth metadata...');
      const authMetadata = authData.user.user_metadata || {};
      const uniqueId = authMetadata.unique_id || String(Math.floor(10000000 + Math.random() * 90000000));
      
      const { data: newProfileData, error: insertError } = await supabase
        .rpc('create_user_profile', {
          user_id: authData.user.id,
          user_unique_id: uniqueId,
          user_name: authMetadata.name || email.split('@')[0],
          user_email: email,
          user_phone: authMetadata.phone || null,
          user_dob: authMetadata.date_of_birth || null,
          user_bio: authMetadata.bio || null,
          user_profile_picture: null,
        });

      if (insertError) {
        console.error('Failed to create profile:', insertError);
        throw new Error('Failed to create user profile');
      }

      profile = Array.isArray(newProfileData) ? newProfileData[0] : newProfileData;

      // Also create wallet using RPC
      await supabase.rpc('create_user_wallet', { p_user_id: authData.user.id });
      
      console.log('Profile and wallet created for user:', authData.user.id);
    } else if (profileError) {
      throw profileError;
    }

    // Ensure wallet exists
    const { data: wallet } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', authData.user.id)
      .single();

    if (!wallet) {
      await supabase.rpc('create_user_wallet', { p_user_id: authData.user.id });
    }

    // Initialize gamification profile for existing users (if not exists)
    try {
      await GamificationService.initializeUser(authData.user.id);
    } catch (gamificationError) {
      console.error('Failed to initialize gamification on login (non-blocking):', gamificationError);
    }

    return { user: profile as User, session: authData.session };
  }

  static async logout(): Promise<void> {
    await supabase.auth.signOut();
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
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        if (error.message?.includes('Refresh Token') || error.message?.includes('Invalid')) {
          await supabase.auth.signOut();
        }
        return null;
      }
      
      if (!session || !session.user) {
        return null;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (!profile) return null;

      // Check if profile is complete (has phone and DOB)
      // Incomplete profiles from social auth need to complete signup flow
      const isProfileComplete = Boolean(profile.phone && profile.date_of_birth);
      if (!isProfileComplete) {
        console.log('[AuthService] Profile incomplete (missing phone/DOB), not restoring session');
        return null;
      }

      return { user: profile as User, session };
    } catch (error: any) {
      if (error?.message?.includes('Refresh Token') || error?.message?.includes('Invalid')) {
        try {
          await supabase.auth.signOut();
        } catch {}
      }
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

  // Upload profile picture to storage ONLY (no database update)
  // Used during signup to get URL before initial INSERT
  static async uploadProfilePictureToStorage(userId: string, fileUri: string): Promise<string> {
    console.log('uploadProfilePictureToStorage called with userId:', userId);
    console.log('Full file URI:', fileUri);
    
    let fileExt = 'jpg';
    const uriParts = fileUri.split('.');
    if (uriParts.length > 1) {
      const lastPart = uriParts[uriParts.length - 1].split('?')[0].toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(lastPart)) {
        fileExt = lastPart;
      }
    }
    
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `profile-pictures/${fileName}`;
    console.log('File path:', filePath, 'Extension:', fileExt);

    let uploadData: ArrayBuffer | Blob;
    let contentType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;

    try {
      if (Platform.OS === 'web') {
        console.log('Web platform - using fetch/blob');
        const response = await fetch(fileUri);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }
        uploadData = await response.blob();
        console.log('Blob size:', (uploadData as Blob).size);
      } else {
        console.log('Native platform - using FileSystem');
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        console.log('File info:', JSON.stringify(fileInfo));
        
        if (!fileInfo.exists) {
          throw new Error('File does not exist at URI');
        }
        
        const base64 = await FileSystem.readAsStringAsync(fileUri, {
          encoding: 'base64',
        });
        console.log('Base64 length:', base64.length);
        
        if (!base64 || base64.length === 0) {
          throw new Error('Failed to read file as base64');
        }
        
        uploadData = decode(base64);
        console.log('Decoded ArrayBuffer size:', (uploadData as ArrayBuffer).byteLength);
      }
    } catch (fileError: any) {
      console.error('Error reading file:', fileError);
      throw new Error(`Failed to read image file: ${fileError.message}`);
    }

    console.log('Uploading to Supabase storage...');
    const { error: uploadError } = await supabase.storage
      .from('user-uploads')
      .upload(filePath, uploadData, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError);
      throw uploadError;
    }

    console.log('Upload successful, getting public URL...');
    const { data: { publicUrl } } = supabase.storage
      .from('user-uploads')
      .getPublicUrl(filePath);
    console.log('Public URL:', publicUrl);

    return publicUrl;
  }

  // Upload profile picture and update user profile (for profile screen)
  static async uploadProfilePicture(userId: string, fileUri: string): Promise<string> {
    console.log('uploadProfilePicture called with userId:', userId);
    console.log('Full file URI:', fileUri);
    
    // Handle different URI formats
    let cleanUri = fileUri;
    
    // Extract file extension properly
    let fileExt = 'jpg';
    const uriParts = fileUri.split('.');
    if (uriParts.length > 1) {
      const lastPart = uriParts[uriParts.length - 1].split('?')[0].toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(lastPart)) {
        fileExt = lastPart;
      }
    }
    
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `profile-pictures/${fileName}`;
    console.log('File path:', filePath, 'Extension:', fileExt);

    let uploadData: ArrayBuffer | Blob;
    let contentType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;

    try {
      if (Platform.OS === 'web') {
        console.log('Web platform - using fetch/blob');
        const response = await fetch(fileUri);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }
        uploadData = await response.blob();
        console.log('Blob size:', (uploadData as Blob).size);
      } else {
        console.log('Native platform - using FileSystem');
        
        // Check if file exists
        const fileInfo = await FileSystem.getInfoAsync(cleanUri);
        console.log('File info:', JSON.stringify(fileInfo));
        
        if (!fileInfo.exists) {
          throw new Error('File does not exist at URI');
        }
        
        const base64 = await FileSystem.readAsStringAsync(cleanUri, {
          encoding: 'base64',
        });
        console.log('Base64 length:', base64.length);
        
        if (!base64 || base64.length === 0) {
          throw new Error('Failed to read file as base64');
        }
        
        uploadData = decode(base64);
        console.log('Decoded ArrayBuffer size:', (uploadData as ArrayBuffer).byteLength);
      }
    } catch (fileError: any) {
      console.error('Error reading file:', fileError);
      throw new Error(`Failed to read image file: ${fileError.message}`);
    }

    console.log('Uploading to Supabase storage...');
    const { error: uploadError } = await supabase.storage
      .from('user-uploads')
      .upload(filePath, uploadData, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError);
      throw uploadError;
    }

    console.log('Upload successful, getting public URL...');
    const { data: { publicUrl } } = supabase.storage
      .from('user-uploads')
      .getPublicUrl(filePath);
    console.log('Public URL:', publicUrl);

    console.log('Updating user profile with picture URL...');
    await this.updateProfile(userId, { profile_picture: publicUrl });
    console.log('Profile updated successfully');

    return publicUrl;
  }

  static async uploadProfilePictureWeb(userId: string, file: File, fileName: string): Promise<string> {
    const fileExt = fileName.split('.').pop() || 'jpg';
    const newFileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `profile-pictures/${newFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('user-uploads')
      .upload(filePath, file, {
        contentType: file.type || `image/${fileExt}`,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('user-uploads')
      .getPublicUrl(filePath);

    await this.updateProfile(userId, { profile_picture: publicUrl });

    return publicUrl;
  }

  static async deleteAccount(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://splinepay.replit.app';
    
    const response = await fetch(`${backendUrl}/api/delete-account`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let errorMessage = 'Failed to delete account';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (parseError) {
        // Response was not JSON, use status text
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    await supabase.auth.signOut();
  }
}
