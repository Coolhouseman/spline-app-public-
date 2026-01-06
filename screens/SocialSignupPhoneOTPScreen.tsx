import React, { useState, useRef, useEffect } from 'react';
import { View, TextInput, StyleSheet, Pressable, Keyboard, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenKeyboardAwareScrollView } from '@/components/ScreenKeyboardAwareScrollView';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { TwilioService } from '@/services/twilio.service';
import { supabase } from '@/services/supabase';

type Props = NativeStackScreenProps<any, 'SocialSignupPhoneOTP'>;

export default function SocialSignupPhoneOTPScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const params = route.params as { 
    userId: string;
    email?: string;
    fullName?: string;
    provider: 'apple' | 'google';
    phone: string;
  };

  if (!params?.userId || !params?.phone) {
    return (
      <ScreenKeyboardAwareScrollView contentContainerStyle={styles.container}>
        <View style={styles.content}>
          <ThemedText style={[Typography.hero, { color: theme.text, marginBottom: Spacing.md }]}>
            Something went wrong
          </ThemedText>
          <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
            We could not complete your verification. Please try again.
          </ThemedText>
        </View>
      </ScreenKeyboardAwareScrollView>
    );
  }
  
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendDisabled, setResendDisabled] = useState(true);
  const [countdown, setCountdown] = useState(60);
  
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const hiddenInputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setResendDisabled(false);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newCode = ['', '', '', '', '', ''];
      digits.forEach((digit, i) => {
        newCode[i] = digit;
      });
      setCode(newCode);
      setError('');
      
      if (digits.length === 6) {
        Keyboard.dismiss();
        handleVerify(newCode.join(''));
      } else if (digits.length > 0) {
        inputRefs.current[digits.length]?.focus();
      }
      return;
    }
    
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setError('');

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newCode.every(digit => digit !== '') && newCode.join('').length === 6) {
      Keyboard.dismiss();
      handleVerify(newCode.join(''));
    }
  };
  
  const handleHiddenInputChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    if (digits.length > 0) {
      const newCode = ['', '', '', '', '', ''];
      digits.split('').forEach((digit, i) => {
        newCode[i] = digit;
      });
      setCode(newCode);
      setError('');
      
      if (digits.length === 6) {
        Keyboard.dismiss();
        handleVerify(digits);
      } else {
        inputRefs.current[digits.length]?.focus();
      }
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (otp?: string) => {
    const otpCode = otp || code.join('');
    
    if (otpCode.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await TwilioService.verifyOTP(params.phone, otpCode);

      if (result.valid) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            phone: params.phone,
            updated_at: new Date().toISOString()
          })
          .eq('id', params.userId);

        if (updateError) {
          setError('Failed to update profile. Please try again.');
          return;
        }

        navigation.navigate('SocialSignupDOB', { 
          userId: params.userId,
          fullName: params.fullName,
          provider: params.provider,
          phone: params.phone
        });
      } else {
        setError(result.error || 'Invalid verification code. Please try again.');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendDisabled(true);
    setCountdown(60);
    setError('');
    setCode(['', '', '', '', '', '']);

    try {
      const result = await TwilioService.sendOTP(params.phone);
      
      if (!result.success) {
        setError(result.error || 'Failed to resend code');
        setResendDisabled(false);
        setCountdown(0);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
      setResendDisabled(false);
      setCountdown(0);
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setResendDisabled(false);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const maskedPhone = params.phone.replace(/(\+\d{2})(\d+)(\d{2})$/, '$1 ••••• $3');

  return (
    <ScreenKeyboardAwareScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing['2xl'] }]}>
          Phone Verification
        </ThemedText>

        <ThemedText style={[Typography.hero, { color: theme.text, marginBottom: Spacing.md }]}>
          Enter verification code
        </ThemedText>

        <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing['2xl'] }]}>
          We sent a 6-digit code to {maskedPhone}
        </ThemedText>

        {Platform.OS === 'ios' ? (
          <TextInput
            ref={hiddenInputRef}
            style={styles.hiddenInput}
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            keyboardType="number-pad"
            onChangeText={handleHiddenInputChange}
            autoFocus
          />
        ) : null}
        
        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputRefs.current[index] = ref; }}
              style={[
                styles.codeInput,
                { 
                  backgroundColor: theme.surface, 
                  color: theme.text, 
                  borderColor: error ? Colors.light.danger : (digit ? theme.primary : theme.border),
                }
              ]}
              value={digit}
              onChangeText={(value) => handleCodeChange(index, value)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
              keyboardType="number-pad"
              maxLength={6}
              selectTextOnFocus
              autoFocus={Platform.OS !== 'ios' && index === 0}
              textContentType={index === 0 ? 'oneTimeCode' : 'none'}
              autoComplete={index === 0 ? 'sms-otp' : 'off'}
            />
          ))}
        </View>

        {error ? (
          <ThemedText style={[Typography.caption, { color: Colors.light.danger, marginTop: Spacing.md, textAlign: 'center' }]}>
            {error}
          </ThemedText>
        ) : null}

        <View style={styles.resendContainer}>
          {resendDisabled ? (
            <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
              Resend code in {countdown}s
            </ThemedText>
          ) : (
            <Pressable onPress={handleResend}>
              <ThemedText style={[Typography.body, { color: theme.primary, fontWeight: '600' }]}>
                Resend Code
              </ThemedText>
            </Pressable>
          )}
        </View>
      </ThemedView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { 
              backgroundColor: theme.primary, 
              opacity: pressed || loading ? 0.7 : (code.every(d => d) ? 1 : 0.4)
            }
          ]}
          onPress={() => handleVerify()}
          disabled={loading || !code.every(d => d)}
        >
          <ThemedText style={[Typography.body, { color: Colors.light.buttonText, fontWeight: '600' }]}>
            {loading ? 'Verifying...' : 'Verify'}
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
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  codeInput: {
    flex: 1,
    height: 56,
    borderWidth: 2,
    borderRadius: BorderRadius.sm,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: Spacing.xl,
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
