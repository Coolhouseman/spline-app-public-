import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TextInput, Pressable, Keyboard, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ThemedText } from '@/components/ThemedText';
import { ScreenKeyboardAwareScrollView } from '@/components/ScreenKeyboardAwareScrollView';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';

type Props = NativeStackScreenProps<any, 'SocialSignupPhoneOTP'>;

export default function SocialSignupPhoneOTPScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { refreshUser } = useAuth();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  
  const phone = route.params?.phone;
  const userId = route.params?.userId;

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleOtpChange = (value: string, index: number) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newOtp = [...otp];
      digits.forEach((digit, i) => {
        if (index + i < 6) {
          newOtp[index + i] = digit;
        }
      });
      setOtp(newOtp);
      
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
      
      if (newOtp.every(d => d !== '')) {
        verifyOtp(newOtp.join(''));
      }
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value.replace(/\D/g, '');
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOtp.every(d => d !== '')) {
      verifyOtp(newOtp.join(''));
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyOtp = async (code: string) => {
    Keyboard.dismiss();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.verifyOtp({
        phone,
        token: code,
        type: 'sms',
      });

      if (error) {
        console.error('OTP verification error:', error);
        Alert.alert('Invalid Code', 'The code you entered is incorrect. Please try again.');
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        return;
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({
          phone,
          phone_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) {
        console.error('Profile update error:', updateError);
      }

      await refreshUser();
      
      navigation.reset({
        index: 0,
        routes: [{ name: 'SocialSignupComplete' }],
      });
    } catch (error: any) {
      console.error('Verification error:', error);
      Alert.alert('Error', error.message || 'Verification failed');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone,
      });

      if (error) {
        Alert.alert('Error', error.message || 'Failed to resend code');
        return;
      }

      setResendTimer(60);
      Alert.alert('Code Sent', 'A new verification code has been sent to your phone');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend code');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhone = (phoneNumber: string) => {
    if (phoneNumber.startsWith('+64')) {
      const numbers = phoneNumber.slice(3);
      if (numbers.length >= 9) {
        return '+64 ' + numbers.slice(0, 2) + ' ' + numbers.slice(2, 5) + ' ' + numbers.slice(5);
      }
    }
    return phoneNumber;
  };

  return (
    <ScreenKeyboardAwareScrollView contentContainerStyle={styles.container}>
      <View style={styles.content}>
        <View style={styles.headerContainer}>
          <ThemedText style={[Typography.h1, styles.title, { color: theme.text }]}>
            Enter verification code
          </ThemedText>
          <ThemedText style={[Typography.body, styles.subtitle, { color: theme.textSecondary }]}>
            We sent a 6-digit code to{'\n'}
            <ThemedText style={{ color: theme.text, fontWeight: '600' }}>
              {formatPhone(phone)}
            </ThemedText>
          </ThemedText>
        </View>

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={[
                styles.otpInput,
                {
                  backgroundColor: theme.surface,
                  color: theme.text,
                  borderColor: digit ? Colors.light.primary : theme.border,
                },
              ]}
              value={digit}
              onChangeText={(value) => handleOtpChange(value, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={6}
              selectTextOnFocus
            />
          ))}
        </View>

        <Pressable onPress={handleResend} disabled={resendTimer > 0 || isLoading}>
          <ThemedText
            style={[
              Typography.body,
              styles.resendText,
              { color: resendTimer > 0 ? theme.textTertiary : Colors.light.primary },
            ]}
          >
            {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend code'}
          </ThemedText>
        </Pressable>
      </View>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
            Verifying...
          </ThemedText>
        </View>
      )}
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
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
  },
  resendText: {
    textAlign: 'center',
    fontWeight: '500',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
});
