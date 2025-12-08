import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenKeyboardAwareScrollView } from '@/components/ScreenKeyboardAwareScrollView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { TwilioService } from '@/services/twilio.service';

type Props = NativeStackScreenProps<any, 'SocialSignupPhone'>;

export default function SocialSignupPhoneScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { clearSignupOverlay } = useAuth();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const params = route.params as { 
    userId: string;
    email?: string;
    fullName?: string;
    provider: 'apple' | 'google';
  };

  // Clear the loading overlay once this screen mounts (navigation is complete)
  useEffect(() => {
    clearSignupOverlay();
  }, []);

  if (!params?.userId) {
    return (
      <ScreenKeyboardAwareScrollView contentContainerStyle={styles.container}>
        <ThemedView style={styles.content}>
          <ThemedText style={[Typography.hero, { color: theme.text, marginBottom: Spacing.md }]}>
            Something went wrong
          </ThemedText>
          <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
            We could not complete your sign-in. Please try again.
          </ThemedText>
        </ThemedView>
      </ScreenKeyboardAwareScrollView>
    );
  }

  const formatPhoneDisplay = (value: string) => {
    const digits = value.replace(/\D/g, '');
    return digits;
  };

  const handlePhoneChange = (text: string) => {
    const formatted = formatPhoneDisplay(text);
    setPhone(formatted);
    if (error) setError('');
  };

  const getFullPhoneNumber = () => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
      return '+64' + cleaned.substring(1);
    }
    return '+64' + cleaned;
  };

  const isValidPhone = () => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 8 && cleaned.length <= 11;
  };

  const handleContinue = async () => {
    if (!isValidPhone()) {
      setError('Please enter a valid phone number');
      return;
    }

    const fullPhone = getFullPhoneNumber();
    setLoading(true);
    setError('');

    try {
      const result = await TwilioService.sendOTP(fullPhone);

      if (result.success) {
        navigation.navigate('SocialSignupPhoneOTP', { 
          ...params, 
          phone: fullPhone 
        });
      } else {
        setError(result.error || 'Failed to send verification code');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const getWelcomeText = () => {
    if (params.fullName) {
      const firstName = params.fullName.split(' ')[0];
      return `Welcome, ${firstName}!`;
    }
    return 'Almost there!';
  };

  return (
    <ScreenKeyboardAwareScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing['2xl'] }]}>
          Phone Verification
        </ThemedText>

        <ThemedText style={[Typography.hero, { color: theme.text, marginBottom: Spacing.md }]}>
          {getWelcomeText()}
        </ThemedText>

        <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.xl }]}>
          To complete your account, we need to verify your phone number via SMS
        </ThemedText>

        <View style={styles.phoneInputContainer}>
          <View style={[styles.prefixContainer, { 
            backgroundColor: theme.surface, 
            borderColor: error ? Colors.light.danger : theme.border 
          }]}>
            <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
              +64
            </ThemedText>
          </View>
          <TextInput
            style={[styles.phoneInput, { 
              backgroundColor: theme.surface, 
              color: theme.text, 
              borderColor: error ? Colors.light.danger : theme.border 
            }]}
            placeholder="21 123 4567"
            placeholderTextColor={theme.textSecondary}
            value={phone}
            onChangeText={handlePhoneChange}
            keyboardType="phone-pad"
            autoFocus
            maxLength={11}
          />
        </View>

        {error ? (
          <ThemedText style={[Typography.caption, { color: Colors.light.danger, marginTop: Spacing.sm }]}>
            {error}
          </ThemedText>
        ) : null}

        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: Spacing.md }]}>
          Standard SMS rates may apply
        </ThemedText>
      </ThemedView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { 
              backgroundColor: theme.primary, 
              opacity: pressed || loading ? 0.7 : (isValidPhone() ? 1 : 0.4)
            }
          ]}
          onPress={handleContinue}
          disabled={!isValidPhone() || loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.light.buttonText} />
          ) : (
            <ThemedText style={[Typography.body, { color: Colors.light.buttonText, fontWeight: '600' }]}>
              Send Verification Code
            </ThemedText>
          )}
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
  phoneInputContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  prefixContainer: {
    height: Spacing.inputHeight,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneInput: {
    flex: 1,
    height: Spacing.inputHeight,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
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
