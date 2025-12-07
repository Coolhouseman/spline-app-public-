import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export interface SocialAuthResult {
  success: boolean;
  userId?: string;
  email?: string;
  fullName?: string;
  needsPhoneVerification?: boolean;
  needsDOB?: boolean;
  needsProfileCompletion?: boolean;
  needsName?: boolean;
  existingPhone?: string;
  error?: string;
}

// Generate a 6-7 digit unique ID
const generateUniqueId = (): string => {
  // Generate 6 or 7 digit number (100000 to 9999999)
  const min = 100000;
  const max = 9999999;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
};

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

      console.log('[Apple Sign-In] Starting sign-in...');
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        return { success: false, error: 'No identity token received from Apple' };
      }

      console.log('[Apple Sign-In] Got credentials, authenticating with Supabase...');
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

      // Apple only provides name on first sign-in, so we capture it here
      const fullName = credential.fullName
        ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
        : undefined;

      console.log('[Apple Sign-In] User authenticated:', data.user.id, 'Name:', fullName);
      const result = await this.handleSocialAuthUser(data.user.id, data.user.email, fullName);
      console.log('[Apple Sign-In] Result:', result);
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
      // Use explicit deep link scheme for native iOS/Android
      // This ensures the OAuth redirect comes back to the app, not the marketing page
      let redirectUrl: string;
      
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        // For native apps, use the explicit deep link scheme
        redirectUrl = 'splitpaymentapp://auth/callback';
      } else {
        // For web, use the standard redirect URI
        redirectUrl = AuthSession.makeRedirectUri({
          scheme: 'splitpaymentapp',
          path: 'auth/callback',
        });
      }
      
      console.log('[Google Sign-In] Starting with redirect URL:', redirectUrl, 'Platform:', Platform.OS);
      
      // Generate a cryptographically secure random state parameter for CSRF protection
      const randomBytes = await Crypto.getRandomBytesAsync(32);
      const stateParam = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Start Supabase OAuth flow with PKCE (authorization code flow)
      const { data: oauthData, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: 'select_account',
            state: stateParam,
          },
        },
      });

      if (oauthError || !oauthData?.url) {
        console.error('[Google Sign-In] OAuth init error:', oauthError);
        return { success: false, error: oauthError?.message || 'Failed to start Google Sign-In' };
      }

      console.log('[Google Sign-In] Opening auth session with Supabase OAuth URL...');
      const result = await WebBrowser.openAuthSessionAsync(oauthData.url, redirectUrl);

      if (result.type !== 'success') {
        console.log('[Google Sign-In] Auth session result:', result.type);
        return { success: false, error: 'Google Sign-In was cancelled' };
      }

      console.log('[Google Sign-In] Auth session successful, processing callback...');
      const url = result.url;
      
      // Parse the URL to extract the auth code or tokens
      // Supabase PKCE flow returns code in query params
      const hashParams = url.includes('#') ? new URLSearchParams(url.split('#')[1]) : null;
      const queryParams = url.includes('?') ? new URLSearchParams(url.split('?')[1]?.split('#')[0]) : null;
      
      // Check for error in redirect
      const errorCode = hashParams?.get('error') || queryParams?.get('error');
      const errorDescription = hashParams?.get('error_description') || queryParams?.get('error_description');
      
      if (errorCode) {
        console.error('[Google Sign-In] OAuth error:', errorCode, errorDescription);
        return { success: false, error: errorDescription || errorCode };
      }
      
      // Validate state parameter to prevent CSRF attacks (mandatory check)
      const returnedState = queryParams?.get('state');
      if (!returnedState) {
        console.error('[Google Sign-In] Missing state parameter in callback');
        return { success: false, error: 'Authentication security check failed. Please try again.' };
      }
      if (returnedState !== stateParam) {
        console.error('[Google Sign-In] State mismatch - possible CSRF attack');
        return { success: false, error: 'Authentication security check failed. Please try again.' };
      }
      
      // PKCE flow: Check for authorization code first (Supabase returns code in query params)
      const code = queryParams?.get('code');
      
      if (code) {
        console.log('[Google Sign-In] Got authorization code, exchanging for session...');
        const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        
        if (exchangeError) {
          console.error('[Google Sign-In] Code exchange error:', exchangeError);
          return { success: false, error: exchangeError.message };
        }
        
        if (!sessionData?.user) {
          return { success: false, error: 'No user returned from authentication' };
        }
        
        console.log('[Google Sign-In] User authenticated via code exchange:', sessionData.user.id);
        const authResult = await this.handleSocialAuthUser(
          sessionData.user.id,
          sessionData.user.email,
          sessionData.user.user_metadata?.full_name || sessionData.user.user_metadata?.name
        );
        console.log('[Google Sign-In] Result:', authResult);
        return authResult;
      }
      
      // Fallback: Check for tokens in hash fragment (implicit flow fallback)
      const accessToken = hashParams?.get('access_token');
      const refreshToken = hashParams?.get('refresh_token');
      
      if (accessToken && refreshToken) {
        console.log('[Google Sign-In] Got tokens from redirect, setting session...');
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          console.error('[Google Sign-In] Session error:', sessionError);
          return { success: false, error: sessionError.message };
        }

        if (!sessionData?.user) {
          return { success: false, error: 'No user returned from authentication' };
        }

        console.log('[Google Sign-In] User authenticated via tokens:', sessionData.user.id);
        const authResult = await this.handleSocialAuthUser(
          sessionData.user.id,
          sessionData.user.email,
          sessionData.user.user_metadata?.full_name || sessionData.user.user_metadata?.name
        );
        console.log('[Google Sign-In] Result:', authResult);
        return authResult;
      }
      
      // If no code or tokens, check current session
      console.log('[Google Sign-In] No code or tokens in URL, checking current session...');
      const { data: { session }, error: getSessionError } = await supabase.auth.getSession();
      
      if (getSessionError) {
        console.error('[Google Sign-In] Get session error:', getSessionError);
        return { success: false, error: getSessionError.message };
      }
      
      if (!session?.user) {
        console.error('[Google Sign-In] No session found after auth. URL was:', url);
        return { success: false, error: 'Authentication failed. Please try again.' };
      }

      console.log('[Google Sign-In] User authenticated from session:', session.user.id);
      const authResult = await this.handleSocialAuthUser(
        session.user.id,
        session.user.email,
        session.user.user_metadata?.full_name || session.user.user_metadata?.name
      );
      console.log('[Google Sign-In] Result:', authResult);
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
      console.log('[Social Auth] Handling user:', userId, 'email:', email, 'name:', fullName);
      
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
        console.log('[Social Auth] Existing user found:', existingUser);
        
        // Check for missing required fields
        const needsPhone = !existingUser.phone;
        const needsDOB = !existingUser.date_of_birth;
        const needsName = !existingUser.name || existingUser.name === 'User';
        
        // If we have a name from OAuth but user profile has generic name, update it
        if (fullName && needsName) {
          console.log('[Social Auth] Updating user name to:', fullName);
          await supabase.from('users').update({ name: fullName }).eq('id', userId);
        }
        
        // Check if wallet exists, create if not
        const { data: wallet, error: walletError } = await supabase
          .from('wallets')
          .select('id')
          .eq('user_id', userId)
          .single();
        
        if (!wallet && (!walletError || walletError.code === 'PGRST116')) {
          console.log('[Social Auth] Creating wallet for existing user...');
          await this.createWalletForUser(userId);
        }
        
        return {
          success: true,
          userId,
          email: email || undefined,
          fullName: existingUser.name || fullName || undefined,
          needsPhoneVerification: needsPhone,
          needsDOB: needsDOB,
          needsProfileCompletion: needsName,
          needsName: needsName,
          existingPhone: existingUser.phone,
        };
      }

      // New user - create profile and wallet
      console.log('[Social Auth] Creating new user profile...');
      
      // Generate a unique 6-7 digit ID for the user
      let uniqueId = generateUniqueId();
      
      // Check for collision and regenerate if needed (up to 5 attempts)
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data: existingId } = await supabase
          .from('users')
          .select('id')
          .eq('unique_id', uniqueId)
          .single();
        
        if (!existingId) break;
        uniqueId = generateUniqueId();
      }
      
      // Use RPC to create profile if available, otherwise direct insert
      const { data: profileData, error: rpcError } = await supabase
        .rpc('create_user_profile', {
          user_id: userId,
          user_unique_id: uniqueId,
          user_name: fullName || 'User',
          user_email: email || '',
          user_phone: null,
          user_dob: null,
          user_bio: null,
          user_profile_picture: null,
        });
      
      if (rpcError) {
        console.log('[Social Auth] RPC failed, using direct insert:', rpcError.message);
        // Fall back to direct insert
        const { error: insertError } = await supabase.from('users').insert({
          id: userId,
          unique_id: uniqueId,
          name: fullName || 'User',
          email: email || '',
          phone: null,
          date_of_birth: null,
          profile_picture: null,
          bio: null,
        });

        if (insertError) {
          console.error('Error creating user profile:', insertError);
          return { success: false, error: 'Failed to create user profile' };
        }
      }
      
      console.log('[Social Auth] Profile created, creating wallet...');
      
      // Create wallet for new user
      await this.createWalletForUser(userId);

      return {
        success: true,
        userId,
        email: email || undefined,
        fullName: fullName || undefined,
        needsPhoneVerification: true,
        needsDOB: true,
        needsProfileCompletion: !fullName,
        needsName: !fullName,
      };
    } catch (error: any) {
      console.error('Error handling social auth user:', error);
      return { success: false, error: error.message || 'Failed to process authentication' };
    }
  },

  async createWalletForUser(userId: string): Promise<void> {
    try {
      // Try RPC first
      const { error: rpcError } = await supabase.rpc('create_user_wallet', {
        p_user_id: userId,
      });
      
      if (rpcError) {
        console.log('[Social Auth] Wallet RPC failed, using direct insert:', rpcError.message);
        // Fall back to direct insert
        const { error: insertError } = await supabase.from('wallets').insert({
          user_id: userId,
          balance: 0,
          bank_connected: false,
        });
        
        if (insertError && insertError.code !== '23505') { // Ignore duplicate key errors
          console.error('Failed to create wallet:', insertError);
        }
      }
      console.log('[Social Auth] Wallet created for user:', userId);
    } catch (error: any) {
      console.error('Error creating wallet:', error);
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
