import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenKeyboardAwareScrollView } from '@/components/ScreenKeyboardAwareScrollView';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';

type Props = NativeStackScreenProps<any, 'SignupPassword'>;

export default function SignupPasswordScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const [password, setPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const params = route.params as { firstName: string; lastName: string; email: string };

  const getPasswordStrength = (pwd: string) => {
    if (pwd.length < 6) return { text: 'Too short', color: theme.danger };
    if (pwd.length < 8) return { text: 'Weak', color: theme.warning };
    if (pwd.length < 12) return { text: 'Good', color: theme.primary };
    return { text: 'Strong', color: theme.success };
  };

  const strength = getPasswordStrength(password);
  const canContinue = password.length >= 6 && agreedToTerms;

  const handleContinue = () => {
    if (canContinue) {
      navigation.navigate('SignupPhone', { ...params, password });
    }
  };

  return (
    <ScreenKeyboardAwareScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing['2xl'] }]}>
          Step 4 of 8
        </ThemedText>

        <ThemedText style={[Typography.hero, { color: theme.text, marginBottom: Spacing.xl }]}>
          Create a password
        </ThemedText>

        <TextInput
          style={[styles.input, { 
            backgroundColor: theme.surface, 
            color: theme.text, 
            borderColor: theme.border 
          }]}
          placeholder="Password (min. 6 characters)"
          placeholderTextColor={theme.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoFocus
          autoCapitalize="none"
        />

        {password.length > 0 ? (
          <ThemedText style={[Typography.caption, { color: strength.color, marginTop: Spacing.sm }]}>
            {strength.text}
          </ThemedText>
        ) : null}

        <Pressable
          style={styles.termsContainer}
          onPress={() => setAgreedToTerms(!agreedToTerms)}
        >
          <View style={[
            styles.checkbox,
            { 
              borderColor: agreedToTerms ? theme.primary : theme.border,
              backgroundColor: agreedToTerms ? theme.primary : 'transparent',
            }
          ]}>
            {agreedToTerms ? (
              <Feather name="check" size={14} color={Colors.light.buttonText} />
            ) : null}
          </View>
          <View style={styles.termsTextContainer}>
            <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
              I agree to the{' '}
            </ThemedText>
            <Pressable onPress={() => navigation.navigate('Terms')}>
              <ThemedText style={[Typography.caption, { color: theme.primary }]}>
                Terms and Conditions
              </ThemedText>
            </Pressable>
            <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
              {' '}and{' '}
            </ThemedText>
            <Pressable onPress={() => navigation.navigate('PrivacyPolicy')}>
              <ThemedText style={[Typography.caption, { color: theme.primary }]}>
                Privacy Policy
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </ThemedView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { 
              backgroundColor: theme.primary, 
              opacity: pressed ? 0.7 : (!canContinue ? 0.4 : 1)
            }
          ]}
          onPress={handleContinue}
          disabled={!canContinue}
        >
          <ThemedText style={[Typography.body, { color: Colors.light.buttonText, fontWeight: '600' }]}>
            Continue
          </ThemedText>
        </Pressable>
      </View>
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
    fontSize: 16,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: Spacing.xl,
    paddingRight: Spacing.lg,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
    marginTop: 1,
  },
  termsTextContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  button: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
