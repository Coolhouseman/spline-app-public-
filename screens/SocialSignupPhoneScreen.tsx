import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TextInput, Pressable, Keyboard, Alert, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ThemedText } from '@/components/ThemedText';
import { ScreenKeyboardAwareScrollView } from '@/components/ScreenKeyboardAwareScrollView';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { supabase } from '@/services/supabase';

type Props = NativeStackScreenProps<any, 'SocialSignupPhone'>;

export default function SocialSignupPhoneScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const [phone, setPhone] = useState('+64 ');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);
  
  const userId = route.params?.userId;
  const email = route.params?.email;
  const fullName = route.params?.fullName;

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const formatPhoneNumber = (text: string) => {
    let cleaned = text.replace(/[^\d+]/g, '');
    
    if (!cleaned.startsWith('+')) {
      cleaned = '+64' + cleaned;
    }
    
    if (cleaned.startsWith('+64')) {
      const numbers = cleaned.slice(3);
      if (numbers.length <= 2) {
        return '+64 ' + numbers;
      } else if (numbers.length <= 5) {
        return '+64 ' + numbers.slice(0, 2) + ' ' + numbers.slice(2);
      } else if (numbers.length <= 8) {
        return '+64 ' + numbers.slice(0, 2) + ' ' + numbers.slice(2, 5) + ' ' + numbers.slice(5);
      } else {
        return '+64 ' + numbers.slice(0, 2) + ' ' + numbers.slice(2, 5) + ' ' + numbers.slice(5, 9);
      }
    }
    
    return cleaned;
  };

  const handlePhoneChange = (text: string) => {
    if (text.length < 4) {
      setPhone('+64 ');
      return;
    }
    setPhone(formatPhoneNumber(text));
  };

  const getCleanPhoneNumber = () => {
    return phone.replace(/\s/g, '');
  };

  const isValidPhone = () => {
    const cleaned = getCleanPhoneNumber();
    return cleaned.length >= 12 && cleaned.startsWith('+64');
  };

  const handleContinue = async () => {
    if (!isValidPhone()) {
      Alert.alert('Invalid Phone', 'Please enter a valid NZ phone number');
      return;
    }

    Keyboard.dismiss();
    setIsLoading(true);

    try {
      const cleanedPhone = getCleanPhoneNumber();
      
      const { error } = await supabase.auth.signInWithOtp({
        phone: cleanedPhone,
      });

      if (error) {
        console.error('OTP send error:', error);
        Alert.alert('Error', error.message || 'Failed to send verification code');
        return;
      }

      navigation.navigate('SocialSignupPhoneOTP', {
        phone: cleanedPhone,
        userId,
        email,
        fullName,
      });
    } catch (error: any) {
      console.error('Phone verification error:', error);
      Alert.alert('Error', error.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenKeyboardAwareScrollView contentContainerStyle={styles.container}>
      <View style={styles.content}>
        <View style={styles.headerContainer}>
          <ThemedText style={[Typography.h1, styles.title, { color: theme.text }]}>
            Verify your phone
          </ThemedText>
          <ThemedText style={[Typography.body, styles.subtitle, { color: theme.textSecondary }]}>
            We need to verify your phone number to secure your account and enable payment features.
          </ThemedText>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              {
                backgroundColor: theme.surface,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            value={phone}
            onChangeText={handlePhoneChange}
            placeholder="+64 21 123 4567"
            placeholderTextColor={theme.textTertiary}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            maxLength={16}
          />
        </View>

        <ThemedText style={[Typography.caption, styles.hint, { color: theme.textSecondary }]}>
          We'll send you a 6-digit code to verify your number
        </ThemedText>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: isValidPhone() ? Colors.light.primary : theme.border,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
          onPress={handleContinue}
          disabled={!isValidPhone() || isLoading}
        >
          <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
            {isLoading ? 'Sending...' : 'Send Code'}
          </ThemedText>
        </Pressable>
      </View>
    </ScreenKeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  headerContainer: {
    marginBottom: Spacing['2xl'],
  },
  title: {
    marginBottom: Spacing.md,
  },
  subtitle: {
    lineHeight: 24,
  },
  inputContainer: {
    marginBottom: Spacing.md,
  },
  input: {
    height: 56,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: 18,
    borderWidth: 1,
  },
  hint: {
    textAlign: 'center',
  },
  footer: {
    paddingBottom: Spacing['2xl'],
  },
  button: {
    height: Spacing.buttonHeight + 4,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
