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
  Easing,
  interpolate,
  useDerivedValue,
} from 'react-native-reanimated';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';

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

  const curveStartX = width * 0.1;
  const curveEndX = width * 0.9;
  const curveY = height * 0.32;
  const curveControlY = height * 0.18;
  const controlX = width * 0.5;

  const startPoint = { x: curveStartX, y: curveY };
  const controlPoint = { x: controlX, y: curveControlY };
  const endPoint = { x: curveEndX, y: curveY };

  useEffect(() => {
    fadeIn.value = withTiming(1, { duration: 800 });
    
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const dotPosition = useDerivedValue(() => {
    return quadraticBezier(progress.value, startPoint, controlPoint, endPoint);
  });

  const dotStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: dotPosition.value.x - 12 },
        { translateY: dotPosition.value.y - 12 },
      ],
    };
  });

  const trailDot1Style = useAnimatedStyle(() => {
    const trailProgress = Math.max(0, progress.value - 0.08);
    const pos = quadraticBezier(trailProgress, startPoint, controlPoint, endPoint);
    return {
      transform: [
        { translateX: pos.x - 6 },
        { translateY: pos.y - 6 },
      ],
      opacity: 0.5,
    };
  });

  const trailDot2Style = useAnimatedStyle(() => {
    const trailProgress = Math.max(0, progress.value - 0.16);
    const pos = quadraticBezier(trailProgress, startPoint, controlPoint, endPoint);
    return {
      transform: [
        { translateX: pos.x - 4 },
        { translateY: pos.y - 4 },
      ],
      opacity: 0.3,
    };
  });

  const trailDot3Style = useAnimatedStyle(() => {
    const trailProgress = Math.max(0, progress.value - 0.24);
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
      { translateY: interpolate(fadeIn.value, [0, 1], [20, 0]) },
    ],
  }));

  const curvePathStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fadeIn.value, [0, 1], [0, 0.15]),
  }));

  const generateCurvePoints = () => {
    const points = [];
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      const pos = quadraticBezier(t, startPoint, controlPoint, endPoint);
      points.push(pos);
    }
    return points;
  };

  const curvePoints = generateCurvePoints();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={curvePathStyle}>
          {curvePoints.map((point, index) => (
            <View
              key={index}
              style={[
                styles.curvePoint,
                {
                  left: point.x - 2,
                  top: point.y - 2,
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
          <View style={[styles.iconCircle, { backgroundColor: Colors.light.primary }]}>
            <Feather name="divide" size={32} color="#FFFFFF" />
          </View>
          <ThemedText style={[Typography.hero, { color: theme.text, marginTop: Spacing.lg }]}>
            Split
          </ThemedText>
          <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.sm, textAlign: 'center', paddingHorizontal: Spacing.xl }]}>
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
  curvePoint: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  dot: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      default: {},
    }),
  },
  dotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  trailDot1: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  trailDot2: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
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
    justifyContent: 'flex-start',
    paddingTop: 80,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: Spacing['2xl'] * 3,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Colors.light.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      default: {},
    }),
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
