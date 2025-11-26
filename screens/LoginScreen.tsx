import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenKeyboardAwareScrollView } from '@/components/ScreenKeyboardAwareScrollView';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';

type Props = NativeStackScreenProps<any, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
});
