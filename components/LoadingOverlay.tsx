import React, { useEffect } from 'react';
import { View, StyleSheet, Modal, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { ThemedText } from './ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  fullScreen?: boolean;
}

function PulsingDot({ delay, color }: { delay: number; color: string }) {
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
          withTiming(0.6, { duration: 400, easing: Easing.bezier(0.4, 0, 0.2, 1) })
        ),
        -1,
        false
      )
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
          withTiming(0.4, { duration: 400, easing: Easing.bezier(0.4, 0, 0.2, 1) })
        ),
        -1,
        false
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: color },
        animatedStyle,
      ]}
    />
  );
}

function SpinningRing({ color }: { color: string }) {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(0.9);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1200, easing: Easing.linear }),
      -1,
      false
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 600, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
        withTiming(0.9, { duration: 600, easing: Easing.bezier(0.4, 0, 0.2, 1) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={[styles.ringContainer, animatedStyle]}>
      <View style={[styles.ring, { borderColor: color, borderTopColor: 'transparent' }]} />
    </Animated.View>
  );
}

function LoadingContent({ message, theme }: { message?: string; theme: any }) {
  const fadeIn = useSharedValue(0);

  useEffect(() => {
    fadeIn.value = withTiming(1, { duration: 300 });
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
    transform: [{ scale: interpolate(fadeIn.value, [0, 1], [0.9, 1]) }],
  }));

  return (
    <Animated.View style={[styles.contentContainer, containerStyle]}>
      <View style={[styles.loaderCard, { backgroundColor: theme.surface }]}>
        <View style={styles.dotsContainer}>
          <PulsingDot delay={0} color={theme.primary} />
          <PulsingDot delay={150} color={theme.primary} />
          <PulsingDot delay={300} color={theme.primary} />
        </View>
        {message ? (
          <ThemedText style={[Typography.body, styles.message, { color: theme.text }]}>
            {message}
          </ThemedText>
        ) : null}
      </View>
    </Animated.View>
  );
}

export function LoadingOverlay({ visible, message, fullScreen = false }: LoadingOverlayProps) {
  const { theme, isDark } = useTheme();

  if (!visible) return null;

  const content = (
    <View style={styles.overlay}>
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={30}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.androidOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)' }]} />
      )}
      <LoadingContent message={message} theme={theme} />
    </View>
  );

  if (fullScreen) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        {content}
      </Modal>
    );
  }

  return content;
}

export function LoadingSpinner({ size = 'medium', color }: { size?: 'small' | 'medium' | 'large'; color?: string }) {
  const { theme } = useTheme();
  const spinnerColor = color || theme.primary;
  
  const sizeMap = {
    small: 24,
    medium: 40,
    large: 56,
  };

  const spinnerSize = sizeMap[size];

  return (
    <View style={[styles.spinnerContainer, { width: spinnerSize, height: spinnerSize }]}>
      <SpinningRing color={spinnerColor} />
    </View>
  );
}

export function LoadingDots({ color }: { color?: string }) {
  const { theme } = useTheme();
  const dotColor = color || theme.primary;

  return (
    <View style={styles.inlineDotsContainer}>
      <PulsingDot delay={0} color={dotColor} />
      <PulsingDot delay={150} color={dotColor} />
      <PulsingDot delay={300} color={dotColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  androidOverlay: {
    opacity: 0.95,
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderCard: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.xl,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    minWidth: 140,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  inlineDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  message: {
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
  ringContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    width: '100%',
    height: '100%',
    borderRadius: 100,
    borderWidth: 3,
  },
  spinnerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
