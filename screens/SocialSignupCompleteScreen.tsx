import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';

type Props = NativeStackScreenProps<any, 'SocialSignupComplete'>;

export default function SocialSignupCompleteScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { user, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();
  
  const checkScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    checkScale.value = withDelay(
      200,
      withSpring(1, { damping: 12, stiffness: 150 })
    );
    checkOpacity.value = withDelay(200, withTiming(1, { duration: 300 }));
    contentOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));
    buttonOpacity.value = withDelay(1000, withTiming(1, { duration: 400 }));
  }, []);

  const checkContainerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkOpacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  const handleGetStarted = async () => {
    await refreshUser();
  };

  const firstName = user?.first_name || 'there';

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top }]}>
      <View style={styles.content}>
        <Animated.View style={[styles.checkContainer, checkContainerStyle]}>
          <View style={[styles.checkCircle, { backgroundColor: Colors.light.success }]}>
            <Feather name="check" size={48} color="#FFFFFF" />
          </View>
        </Animated.View>

        <Animated.View style={[styles.textContainer, contentStyle]}>
          <ThemedText style={[Typography.h1, styles.title, { color: theme.text }]}>
            Welcome, {firstName}!
          </ThemedText>
          <ThemedText style={[Typography.body, styles.subtitle, { color: theme.textSecondary }]}>
            Your account is all set up and ready to go. Start splitting bills with your friends!
          </ThemedText>
        </Animated.View>
      </View>

      <Animated.View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.xl }, buttonStyle]}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: Colors.light.primary, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={handleGetStarted}
        >
          <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
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
  checkContainer: {
    marginBottom: Spacing['2xl'],
  },
  checkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Spacing.lg,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
  },
  button: {
    height: Spacing.buttonHeight + 4,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
