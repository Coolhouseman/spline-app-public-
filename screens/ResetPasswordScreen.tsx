import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenKeyboardAwareScrollView } from '@/components/ScreenKeyboardAwareScrollView';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';

type Props = NativeStackScreenProps<any, 'ResetPassword'>;

export default function ResetPasswordScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleResetPassword = async () => {
    setError('');

    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        if (updateError.message.includes('session')) {
          setError('Your reset link has expired. Please request a new one.');
        } else {
          setError(updateError.message);
        }
        return;
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <ScreenKeyboardAwareScrollView contentContainerStyle={styles.container}>
        <ThemedView style={styles.content}>
          <View style={[styles.iconContainer, { backgroundColor: Colors.light.success + '20' }]}>
            <Feather name="check-circle" size={48} color={Colors.light.success} />
          </View>
          
          <ThemedText style={[Typography.h1, { color: theme.text, marginTop: Spacing.xl, textAlign: 'center' }]}>
            Password Updated!
          </ThemedText>
          
          <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.md, textAlign: 'center' }]}>
            Your password has been successfully reset. You can now log in with your new password.
          </ThemedText>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.primary, opacity: pressed ? 0.7 : 1, marginTop: Spacing['2xl'] }
            ]}
            onPress={() => navigation.navigate('Login')}
          >
            <ThemedText style={[Typography.body, { color: Colors.light.buttonText, fontWeight: '600' }]}>
              Go to Login
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
          <Feather name="key" size={48} color={theme.primary} />
        </View>
        
        <ThemedText style={[Typography.h1, { color: theme.text, marginTop: Spacing.xl, textAlign: 'center' }]}>
          Set New Password
        </ThemedText>
        
        <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.md, textAlign: 'center' }]}>
          Enter your new password below. Make sure it's at least 8 characters long.
        </ThemedText>

        <View style={[styles.inputContainer, { marginTop: Spacing['2xl'] }]}>
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.surface, 
              color: theme.text, 
              borderColor: error ? Colors.light.danger : theme.border,
            }]}
            placeholder="New password"
            placeholderTextColor={theme.textSecondary}
            value={newPassword}
            onChangeText={(text) => {
              setNewPassword(text);
              if (error) setError('');
            }}
            secureTextEntry={!showNewPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable 
            style={styles.eyeButton}
            onPress={() => setShowNewPassword(!showNewPassword)}
          >
            <Feather 
              name={showNewPassword ? 'eye-off' : 'eye'} 
              size={20} 
              color={theme.textSecondary} 
            />
          </Pressable>
        </View>

        <View style={[styles.inputContainer, { marginTop: Spacing.md }]}>
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.surface, 
              color: theme.text, 
              borderColor: error ? Colors.light.danger : theme.border,
            }]}
            placeholder="Confirm new password"
            placeholderTextColor={theme.textSecondary}
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (error) setError('');
            }}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable 
            style={styles.eyeButton}
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            <Feather 
              name={showConfirmPassword ? 'eye-off' : 'eye'} 
              size={20} 
              color={theme.textSecondary} 
            />
          </Pressable>
        </View>

        {error ? (
          <ThemedText style={[Typography.caption, { color: Colors.light.danger, marginTop: Spacing.sm }]}>
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
            {loading ? 'Updating...' : 'Reset Password'}
          </ThemedText>
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
  inputContainer: {
    position: 'relative',
  },
  input: {
    height: Spacing.inputHeight,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.lg,
    paddingRight: 50,
    fontSize: 16,
  },
  eyeButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    height: Spacing.inputHeight,
    width: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
});
