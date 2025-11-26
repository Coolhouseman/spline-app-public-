import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenKeyboardAwareScrollView } from '@/components/ScreenKeyboardAwareScrollView';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';

type Props = NativeStackScreenProps<any, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleResetPassword = async () => {
    setError('');
    
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const { error: supabaseError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: undefined,
      });

      if (supabaseError) {
        if (supabaseError.message.includes('rate limit')) {
          setError('Too many requests. Please try again in a few minutes.');
        } else {
          setError(supabaseError.message);
        }
        return;
      }

      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <ScreenKeyboardAwareScrollView contentContainerStyle={styles.container}>
        <ThemedView style={styles.content}>
          <View style={[styles.iconContainer, { backgroundColor: Colors.light.success + '20' }]}>
            <Feather name="mail" size={48} color={Colors.light.success} />
          </View>
          
          <ThemedText style={[Typography.h1, { color: theme.text, marginTop: Spacing.xl, textAlign: 'center' }]}>
            Check Your Email
          </ThemedText>
          
          <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.md, textAlign: 'center' }]}>
            We've sent password reset instructions to:
          </ThemedText>
          
          <ThemedText style={[Typography.body, { color: theme.primary, marginTop: Spacing.sm, fontWeight: '600', textAlign: 'center' }]}>
            {email}
          </ThemedText>
          
          <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: Spacing.xl, textAlign: 'center' }]}>
            Didn't receive the email? Check your spam folder or try again.
          </ThemedText>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.primary, opacity: pressed ? 0.7 : 1, marginTop: Spacing['2xl'] }
            ]}
            onPress={() => navigation.popToTop()}
          >
            <ThemedText style={[Typography.body, { color: Colors.light.buttonText, fontWeight: '600' }]}>
              Back to Login
            </ThemedText>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.linkButton, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => {
              setSent(false);
              setEmail('');
            }}
          >
            <ThemedText style={[Typography.body, { color: theme.primary }]}>
              Try a different email
            </ThemedText>
          </Pressable>
        </ThemedView>
      </ScreenKeyboardAwareScrollView>
    );
  }

  return (
    <ScreenKeyboardAwareScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: theme.primary + '15' }]}>
          <Feather name="lock" size={48} color={theme.primary} />
        </View>
        
        <ThemedText style={[Typography.h1, { color: theme.text, marginTop: Spacing.xl, textAlign: 'center' }]}>
          Forgot Password?
        </ThemedText>
        
        <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.md, textAlign: 'center' }]}>
          No worries! Enter your email address and we'll send you instructions to reset your password.
        </ThemedText>

        <TextInput
          style={[styles.input, { 
            backgroundColor: theme.surface, 
            color: theme.text, 
            borderColor: error ? Colors.light.error : theme.border,
            marginTop: Spacing['2xl']
          }]}
          placeholder="Email address"
          placeholderTextColor={theme.textSecondary}
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (error) setError('');
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />

        {error ? (
          <ThemedText style={[Typography.caption, { color: Colors.light.error, marginTop: Spacing.sm }]}>
            {error}
          </ThemedText>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.primary, opacity: pressed || loading ? 0.7 : 1 }
          ]}
          onPress={handleResetPassword}
          disabled={loading}
        >
          <ThemedText style={[Typography.body, { color: Colors.light.buttonText, fontWeight: '600' }]}>
            {loading ? 'Sending...' : 'Send Reset Link'}
          </ThemedText>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.linkButton, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => navigation.goBack()}
        >
          <View style={styles.backLink}>
            <Feather name="arrow-left" size={16} color={theme.primary} />
            <ThemedText style={[Typography.body, { color: theme.primary, marginLeft: Spacing.xs }]}>
              Back to Login
            </ThemedText>
          </View>
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
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  input: {
    height: Spacing.inputHeight,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
  },
  button: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  linkButton: {
    marginTop: Spacing.xl,
    alignItems: 'center',
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
