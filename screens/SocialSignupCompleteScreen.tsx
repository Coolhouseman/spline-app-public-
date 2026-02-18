import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, TextInput } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  interpolate,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { ReferralsService } from '@/services/referrals.service';

type Props = NativeStackScreenProps<any, 'SocialSignupComplete'>;

export default function SocialSignupCompleteScreen({ route }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { refreshUser } = useAuth();
  const params = route.params as { 
    userId: string;
    fullName?: string;
    provider: 'apple' | 'google';
    referralCode?: string;
  };
  const [referralCode, setReferralCode] = useState(params.referralCode || '');

  const checkmarkScale = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    checkmarkScale.value = withSequence(
      withDelay(300, withSpring(1.2, { damping: 8, stiffness: 100 })),
      withSpring(1, { damping: 12, stiffness: 200 })
    );
    
    contentOpacity.value = withDelay(600, withTiming(1, { duration: 500 }));
    buttonOpacity.value = withDelay(900, withTiming(1, { duration: 500 }));
  }, []);

  const checkmarkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkmarkScale.value }],
    opacity: interpolate(checkmarkScale.value, [0, 0.5, 1], [0, 1, 1]),
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: interpolate(contentOpacity.value, [0, 1], [20, 0]) }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  const handleGetStarted = async () => {
    if (referralCode.trim()) {
      await ReferralsService.registerOnSignup(referralCode);
    }
    await refreshUser();
  };

  const getWelcomeMessage = () => {
    if (params.fullName) {
      const firstName = params.fullName.split(' ')[0];
      return `Welcome to Spline, ${firstName}!`;
    }
    return 'Welcome to Spline!';
  };

  const getProviderMessage = () => {
    const provider = params.provider === 'apple' ? 'Apple' : 'Google';
    return `You signed up with ${provider} and verified your phone number.`;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.content, { paddingTop: insets.top + Spacing['2xl'] }]}>
        <Animated.View style={[styles.checkmarkContainer, checkmarkStyle]}>
          <View style={[styles.checkmarkCircle, { backgroundColor: Colors.light.success }]}>
            <Feather name="check" size={48} color="#FFFFFF" />
          </View>
        </Animated.View>

        <Animated.View style={[styles.textContainer, contentStyle]}>
          <ThemedText style={[Typography.hero, { color: theme.text, textAlign: 'center', marginBottom: Spacing.md }]}>
            {getWelcomeMessage()}
          </ThemedText>
          
          <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center' }]}>
            {getProviderMessage()}
          </ThemedText>
          
          <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.md }]}>
            Your account is all set up and ready to go.
          </ThemedText>

          <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: Spacing.xl, marginBottom: Spacing.xs, alignSelf: 'flex-start', width: '100%' }]}>
            Referral code (optional)
          </ThemedText>
          <TextInput
            style={[
              styles.referralInput,
              {
                backgroundColor: theme.surface,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder="Enter referral code"
            placeholderTextColor={theme.textSecondary}
            value={referralCode}
            onChangeText={setReferralCode}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </Animated.View>
      </View>

      <Animated.View style={[styles.footer, { paddingBottom: insets.bottom + Spacing['2xl'] }, buttonStyle]}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 }
          ]}
          onPress={handleGetStarted}
        >
          <ThemedText style={[Typography.body, { color: Colors.light.buttonText, fontWeight: '600' }]}>
            Get Started
          </ThemedText>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  checkmarkContainer: {
    marginBottom: Spacing['2xl'],
  },
  checkmarkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    alignItems: 'center',
    width: '100%',
  },
  referralInput: {
    width: '100%',
    height: Spacing.inputHeight,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
  },
  button: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
