import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable, useWindowDimensions, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  interpolate,
  useDerivedValue,
} from 'react-native-reanimated';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';

type Props = NativeStackScreenProps<any, 'Welcome'>;

function quadraticBezier(t: number, p0: {x: number, y: number}, p1: {x: number, y: number}, p2: {x: number, y: number}) {
  'worklet';
  const oneMinusT = 1 - t;
  const x = oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x;
  const y = oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y;
  return { x, y };
}

export default function WelcomeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  
  const progress = useSharedValue(0);
  const fadeIn = useSharedValue(0);
  const floatAnim1 = useSharedValue(0);
  const floatAnim2 = useSharedValue(0);
  const floatAnim3 = useSharedValue(0);

  const curveStartX = width * 0.08;
  const curveEndX = width * 0.92;
  const curveY = height * 0.52;
  const curveControlY = height * 0.38;
  const controlX = width * 0.5;

  const startPoint = { x: curveStartX, y: curveY };
  const controlPoint = { x: controlX, y: curveControlY };
  const endPoint = { x: curveEndX, y: curveY };

  useEffect(() => {
    fadeIn.value = withTiming(1, { duration: 1000 });
    
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    floatAnim1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    floatAnim2.value = withDelay(1000, withRepeat(
      withSequence(
        withTiming(1, { duration: 5000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 5000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    ));

    floatAnim3.value = withDelay(2000, withRepeat(
      withSequence(
        withTiming(1, { duration: 3500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 3500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    ));
  }, []);

  const dotPosition = useDerivedValue(() => {
    return quadraticBezier(progress.value, startPoint, controlPoint, endPoint);
  });

  const dotStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: dotPosition.value.x - 14 },
        { translateY: dotPosition.value.y - 14 },
      ],
    };
  });

  const trailDot1Style = useAnimatedStyle(() => {
    const trailProgress = Math.max(0, progress.value - 0.06);
    const pos = quadraticBezier(trailProgress, startPoint, controlPoint, endPoint);
    return {
      transform: [
        { translateX: pos.x - 8 },
        { translateY: pos.y - 8 },
      ],
      opacity: 0.6,
    };
  });

  const trailDot2Style = useAnimatedStyle(() => {
    const trailProgress = Math.max(0, progress.value - 0.12);
    const pos = quadraticBezier(trailProgress, startPoint, controlPoint, endPoint);
    return {
      transform: [
        { translateX: pos.x - 5 },
        { translateY: pos.y - 5 },
      ],
      opacity: 0.35,
    };
  });

  const trailDot3Style = useAnimatedStyle(() => {
    const trailProgress = Math.max(0, progress.value - 0.18);
    const pos = quadraticBezier(trailProgress, startPoint, controlPoint, endPoint);
    return {
      transform: [
        { translateX: pos.x - 3 },
        { translateY: pos.y - 3 },
      ],
      opacity: 0.15,
    };
  });

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: fadeIn.value,
  }));

  const logoFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fadeIn.value, [0, 1], [0, 1]),
    transform: [
      { translateY: interpolate(fadeIn.value, [0, 1], [30, 0]) },
    ],
  }));

  const curvePathStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fadeIn.value, [0, 1], [0, 0.2]),
  }));

  const floatingCircle1Style = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(floatAnim1.value, [0, 1], [0, -20]) },
      { scale: interpolate(floatAnim1.value, [0, 1], [1, 1.1]) },
    ],
    opacity: interpolate(fadeIn.value, [0, 1], [0, 0.08]),
  }));

  const floatingCircle2Style = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(floatAnim2.value, [0, 1], [0, 15]) },
      { scale: interpolate(floatAnim2.value, [0, 1], [1, 0.9]) },
    ],
    opacity: interpolate(fadeIn.value, [0, 1], [0, 0.06]),
  }));

  const floatingCircle3Style = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(floatAnim3.value, [0, 1], [0, -12]) },
      { translateX: interpolate(floatAnim3.value, [0, 1], [0, 8]) },
    ],
    opacity: interpolate(fadeIn.value, [0, 1], [0, 0.05]),
  }));

  const generateCurvePoints = () => {
    const points = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const pos = quadraticBezier(t, startPoint, controlPoint, endPoint);
      points.push(pos);
    }
    return points;
  };

  const curvePoints = generateCurvePoints();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <Animated.View style={[styles.floatingCircle1, { backgroundColor: Colors.light.primary }, floatingCircle1Style]} />
      <Animated.View style={[styles.floatingCircle2, { backgroundColor: Colors.light.primary }, floatingCircle2Style]} />
      <Animated.View style={[styles.floatingCircle3, { backgroundColor: Colors.light.primary }, floatingCircle3Style]} />


      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={curvePathStyle}>
          {curvePoints.map((point, index) => (
            <View
              key={index}
              style={[
                styles.curvePoint,
                {
                  left: point.x - 2.5,
                  top: point.y - 2.5,
                  backgroundColor: Colors.light.primary,
                },
              ]}
            />
          ))}
        </Animated.View>

        <Animated.View style={[styles.trailDot3, { backgroundColor: Colors.light.primary }, trailDot3Style]} />
        <Animated.View style={[styles.trailDot2, { backgroundColor: Colors.light.primary }, trailDot2Style]} />
        <Animated.View style={[styles.trailDot1, { backgroundColor: Colors.light.primary }, trailDot1Style]} />
        <Animated.View style={[styles.dot, { backgroundColor: Colors.light.primary }, dotStyle]}>
          <View style={styles.dotInner} />
        </Animated.View>
      </View>

      <Animated.View style={[styles.content, { paddingTop: insets.top + Spacing['2xl'] }, logoFadeStyle]}>
        <View style={styles.logoContainer}>
          <View style={styles.logoTextContainer}>
            <ThemedText style={[styles.logoText, { color: Colors.light.primary }]}>
              Sp
            </ThemedText>
            <ThemedText style={[styles.logoText, { color: theme.text }]}>
              line
            </ThemedText>
          </View>
          <View style={styles.logoUnderline}>
            <View style={[styles.underlineSegment, { backgroundColor: Colors.light.primary }]} />
            <View style={[styles.underlineDot, { backgroundColor: Colors.light.primary }]} />
          </View>
          <ThemedText style={[Typography.body, styles.tagline, { color: theme.textSecondary }]}>
            Split bills effortlessly with friends
          </ThemedText>
        </View>
      </Animated.View>

      <Animated.View style={[styles.buttonContainer, { paddingBottom: insets.bottom + Spacing['2xl'] }, fadeStyle]}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: Colors.light.primary, opacity: pressed ? 0.8 : 1 }
          ]}
          onPress={() => navigation.navigate('Login')}
        >
          <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
            Login
          </ThemedText>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.secondaryButton,
            { 
              backgroundColor: theme.surface, 
              borderColor: Colors.light.primary,
              opacity: pressed ? 0.8 : 1 
            }
          ]}
          onPress={() => navigation.navigate('SignupFirstName')}
        >
          <ThemedText style={[Typography.body, { color: Colors.light.primary, fontWeight: '600' }]}>
            Create Account
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
  floatingCircle1: {
    position: 'absolute',
    top: '15%',
    left: '10%',
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  floatingCircle2: {
    position: 'absolute',
    top: '55%',
    right: '-10%',
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  floatingCircle3: {
    position: 'absolute',
    bottom: '20%',
    left: '-5%',
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  curvePoint: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dot: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
      default: {},
    }),
  },
  dotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  trailDot1: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  trailDot2: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  trailDot3: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  logoTextContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  logoText: {
    fontSize: 56,
    fontWeight: '700',
    letterSpacing: -1,
  },
  logoUnderline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    gap: 6,
  },
  underlineSegment: {
    width: 60,
    height: 4,
    borderRadius: 2,
  },
  underlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tagline: {
    marginTop: Spacing.lg,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  buttonContainer: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  primaryButton: {
    height: Spacing.buttonHeight + 4,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButton: {
    height: Spacing.buttonHeight + 4,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
});
