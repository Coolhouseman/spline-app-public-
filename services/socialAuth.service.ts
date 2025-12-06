import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export interface SocialAuthResult {
  success: boolean;
  userId?: string;
  email?: string;
  fullName?: string;
  needsPhoneVerification?: boolean;
  needsProfileCompletion?: boolean;
  error?: string;
}

export const SocialAuthService = {
  async signInWithApple(): Promise<SocialAuthResult> {
    try {
      if (Platform.OS !== 'ios') {
        return { success: false, error: 'Apple Sign-In is only available on iOS' };
      }

      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        return { success: false, error: 'Apple Sign-In is not available on this device' };
      }

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        return { success: false, error: 'No identity token received from Apple' };
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) {
        console.error('Supabase Apple auth error:', error);
        return { success: false, error: error.message };
      }

      if (!data.user) {
        return { success: false, error: 'No user returned from authentication' };
      }

      const fullName = credential.fullName
        ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
        : undefined;

      const result = await this.handleSocialAuthUser(data.user.id, data.user.email, fullName);
      return result;
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        return { success: false, error: 'Sign-in was cancelled' };
      }
      console.error('Apple Sign-In error:', error);
      return { success: false, error: error.message || 'Apple Sign-In failed' };
    }
  },

  async signInWithGoogle(): Promise<SocialAuthResult> {
    try {
      const redirectUrl = Linking.createURL('auth/callback');
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        console.error('Supabase Google auth error:', error);
        return { success: false, error: error.message };
      }

      if (!data.url) {
        return { success: false, error: 'No authentication URL received' };
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      if (result.type !== 'success') {
        return { success: false, error: 'Google Sign-In was cancelled' };
      }

      const url = result.url;
      const params = new URLSearchParams(url.split('#')[1] || url.split('?')[1] || '');
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (!accessToken) {
        return { success: false, error: 'No access token received' };
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || '',
      });

      if (sessionError) {
        console.error('Session error:', sessionError);
        return { success: false, error: sessionError.message };
      }

      if (!sessionData.user) {
        return { success: false, error: 'No user returned from authentication' };
      }

      const authResult = await this.handleSocialAuthUser(
        sessionData.user.id,
        sessionData.user.email,
        sessionData.user.user_metadata?.full_name
      );
      return authResult;
    } catch (error: any) {
      console.error('Google Sign-In error:', error);
      return { success: false, error: error.message || 'Google Sign-In failed' };
    }
  },

  async handleSocialAuthUser(
    userId: string,
    email?: string | null,
    fullName?: string | null
  ): Promise<SocialAuthResult> {
    try {
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching user:', fetchError);
        return { success: false, error: 'Failed to check user profile' };
      }

      if (existingUser) {
        const needsPhone = !existingUser.phone || !existingUser.phone_verified;
        const needsProfile = !existingUser.first_name || !existingUser.last_name;
        
        return {
          success: true,
          userId,
          email: email || undefined,
          fullName: fullName || undefined,
          needsPhoneVerification: needsPhone,
          needsProfileCompletion: needsProfile,
        };
      }

      const nameParts = fullName?.split(' ') || [];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const { error: insertError } = await supabase.from('users').insert({
        id: userId,
        email: email || '',
        first_name: firstName,
        last_name: lastName,
        phone: '',
        phone_verified: false,
        date_of_birth: null,
        profile_picture: null,
        bio: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error('Error creating user profile:', insertError);
        return { success: false, error: 'Failed to create user profile' };
      }

      return {
        success: true,
        userId,
        email: email || undefined,
        fullName: fullName || undefined,
        needsPhoneVerification: true,
        needsProfileCompletion: !firstName,
      };
    } catch (error: any) {
      console.error('Error handling social auth user:', error);
      return { success: false, error: error.message || 'Failed to process authentication' };
    }
  },

  async isAppleSignInAvailable(): Promise<boolean> {
    if (Platform.OS !== 'ios') return false;
    try {
      return await AppleAuthentication.isAvailableAsync();
    } catch {
      return false;
    }
  },
};
