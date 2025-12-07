import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Pressable, Alert, Platform, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenKeyboardAwareScrollView } from '@/components/ScreenKeyboardAwareScrollView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { SocialAuthService } from '@/services/socialAuth.service';

type Props = NativeStackScreenProps<any, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { login, refreshUser, setSocialSignupInProgress } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showAppleButton, setShowAppleButton] = useState(false);

  useEffect(() => {
    SocialAuthService.isAppleSignInAvailable().then(setShowAppleButton);
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const success = await login(email, password);
      if (!success) {
        Alert.alert('Error', 'Invalid email or password');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSocialAuthResult = async (result: any, provider: 'apple' | 'google') => {
    if (result.success && result.userId) {
      if (result.needsName) {
        navigation.navigate('SocialSignupName', {
          userId: result.userId,
          email: result.email,
          provider,
          needsPhone: result.needsPhoneVerification,
          needsDOB: result.needsDOB,
          existingPhone: result.existingPhone,
        });
      } else if (result.needsPhoneVerification) {
        navigation.navigate('SocialSignupPhone', {
          userId: result.userId,
          email: result.email,
          fullName: result.fullName,
          provider,
        });
      } else if (result.needsDOB) {
        navigation.navigate('SocialSignupDOB', {
          userId: result.userId,
          fullName: result.fullName,
          provider,
          phone: result.existingPhone,
        });
      } else {
        await refreshUser();
      }
    } else {
      setSocialSignupInProgress(false);
      if (result.error && result.error !== 'Sign-in was cancelled' && result.error !== 'Google Sign-In was cancelled') {
        Alert.alert('Sign-In Failed', result.error);
      }
    }
  };

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    setSocialSignupInProgress(true);
    try {
      const result = await SocialAuthService.signInWithApple();
      await handleSocialAuthResult(result, 'apple');
    } catch (error: any) {
      setSocialSignupInProgress(false);
      Alert.alert('Error', error.message || 'Apple Sign-In failed');
    } finally {
      setAppleLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setSocialSignupInProgress(true);
    try {
      const result = await SocialAuthService.signInWithGoogle();
      await handleSocialAuthResult(result, 'google');
    } catch (error: any) {
      setSocialSignupInProgress(false);
      Alert.alert('Error', error.message || 'Google Sign-In failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <ScreenKeyboardAwareScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText style={[Typography.hero, { color: theme.text, marginBottom: Spacing.sm }]}>
          Welcome Back
        </ThemedText>
        <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing['2xl'] }]}>
          Sign in to continue splitting bills
        </ThemedText>

        <TextInput
          style={[styles.input, { 
            backgroundColor: theme.surface, 
            color: theme.text, 
            borderColor: theme.border 
          }]}
          placeholder="Email"
          placeholderTextColor={theme.textSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={[styles.input, { 
            backgroundColor: theme.surface, 
            color: theme.text, 
            borderColor: theme.border 
          }]}
          placeholder="Password"
          placeholderTextColor={theme.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <Pressable
          style={({ pressed }) => [styles.forgotButton, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => navigation.navigate('ForgotPassword')}
        >
          <ThemedText style={[Typography.caption, { color: theme.primary }]}>
            Forgot Password?
          </ThemedText>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.primary, opacity: pressed ? 0.7 : 1 }
          ]}
          onPress={handleLogin}
          disabled={loading}
        >
          <ThemedText style={[Typography.body, { color: Colors.light.buttonText, fontWeight: '600' }]}>
            {loading ? 'Signing in...' : 'Sign In'}
          </ThemedText>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.linkButton, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => navigation.navigate('SignupFirstName')}
        >
          <ThemedText style={[Typography.body, { color: theme.primary }]}>
            Don't have an account? Sign up
          </ThemedText>
        </Pressable>

        <View style={styles.dividerContainer}>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginHorizontal: Spacing.md }]}>
            or continue with
          </ThemedText>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
        </View>

        {showAppleButton && (
          <Pressable
            style={({ pressed }) => [
              styles.socialButton,
              { backgroundColor: '#000', opacity: pressed ? 0.8 : 1 }
            ]}
            onPress={handleAppleSignIn}
            disabled={appleLoading}
          >
            {appleLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Feather name="smartphone" size={20} color="#fff" style={styles.socialIcon} />
                <ThemedText style={[Typography.body, { color: '#fff', fontWeight: '600' }]}>
                  Continue with Apple
                </ThemedText>
              </>
            )}
          </Pressable>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.socialButton,
            { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, opacity: pressed ? 0.8 : 1 }
          ]}
          onPress={handleGoogleSignIn}
          disabled={googleLoading}
        >
          {googleLoading ? (
            <ActivityIndicator color={theme.text} size="small" />
          ) : (
            <>
              <ThemedText style={[styles.googleIcon, { marginRight: Spacing.sm }]}>G</ThemedText>
              <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
                Continue with Google
              </ThemedText>
            </>
          )}
        </Pressable>
      </ThemedView>
    </ScreenKeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  input: {
    height: Spacing.inputHeight,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    fontSize: 16,
  },
  button: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.sm,
  },
  linkButton: {
    marginTop: Spacing.xl,
    alignItems: 'center',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  socialButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  socialIcon: {
    marginRight: Spacing.sm,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4285F4',
  },
});
