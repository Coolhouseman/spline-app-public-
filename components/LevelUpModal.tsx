import React, { useEffect } from 'react';
import { View, StyleSheet, Modal, Pressable, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
  withTiming,
  runOnJS,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from './ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { GamificationService, LEVEL_INFO } from '@/services/gamification.service';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

interface LevelUpModalProps {
  visible: boolean;
  newLevel: number;
  oldLevel: number;
  newTitle: string;
  totalXp: number;
  onDismiss: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CONFETTI_COLORS = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];

interface ConfettiPiece {
  x: number;
  delay: number;
  color: string;
  rotation: number;
  size: number;
}

function ConfettiParticle({ piece }: { piece: ConfettiPiece }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      piece.delay,
      withTiming(1, { duration: 2500, easing: Easing.out(Easing.quad) })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: piece.x },
        { translateY: interpolate(progress.value, [0, 1], [-20, SCREEN_HEIGHT * 0.8]) },
        { rotate: `${interpolate(progress.value, [0, 1], [0, piece.rotation])}deg` },
        { scale: interpolate(progress.value, [0, 0.2, 1], [0, 1, 0.5]) },
      ],
      opacity: interpolate(progress.value, [0, 0.1, 0.8, 1], [0, 1, 1, 0]),
    };
  });

  return (
    <Animated.View
      style={[
        styles.confetti,
        { backgroundColor: piece.color, width: piece.size, height: piece.size * 1.5 },
        animatedStyle,
      ]}
    />
  );
}

export function LevelUpModal({ visible, newLevel, oldLevel, newTitle, totalXp, onDismiss }: LevelUpModalProps) {
  const { theme: colors } = useTheme();
  const scale = useSharedValue(0);
  const starScale = useSharedValue(0);
  const badgeRotation = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(0);

  const levelColor = GamificationService.getLevelColor(newLevel);
  const levelInfo = LEVEL_INFO[newLevel] || { title: newTitle };
  const hasPerk = levelInfo.perk;

  const confettiPieces: ConfettiPiece[] = Array.from({ length: 30 }, (_, i) => ({
    x: Math.random() * SCREEN_WIDTH - SCREEN_WIDTH / 2,
    delay: Math.random() * 500,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    rotation: 360 * (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 2 + 1),
    size: 8 + Math.random() * 8,
  }));

  useEffect(() => {
    if (visible) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      scale.value = withSpring(1, { damping: 8, stiffness: 100 });
      
      starScale.value = withDelay(
        300,
        withSequence(
          withSpring(1.3, { damping: 5 }),
          withSpring(1, { damping: 8 })
        )
      );

      badgeRotation.value = withDelay(
        200,
        withSequence(
          withTiming(-10, { duration: 100 }),
          withTiming(10, { duration: 100 }),
          withTiming(-5, { duration: 100 }),
          withTiming(5, { duration: 100 }),
          withTiming(0, { duration: 100 })
        )
      );

      glowOpacity.value = withDelay(
        400,
        withSequence(
          withTiming(0.8, { duration: 300 }),
          withTiming(0.3, { duration: 500 }),
          withTiming(0.6, { duration: 400 })
        )
      );

      buttonScale.value = withDelay(800, withSpring(1, { damping: 10 }));
    } else {
      scale.value = 0;
      starScale.value = 0;
      badgeRotation.value = 0;
      glowOpacity.value = 0;
      buttonScale.value = 0;
    }
  }, [visible]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));

  const starStyle = useAnimatedStyle(() => ({
    transform: [{ scale: starScale.value }],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${badgeRotation.value}deg` }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const buttonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
    opacity: buttonScale.value,
  }));

  const handleDismiss = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onDismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
        {visible ? confettiPieces.map((piece, index) => (
          <ConfettiParticle key={index} piece={piece} />
        )) : null}

        <Animated.View style={[styles.content, containerStyle]}>
          <Animated.View style={[styles.glow, { backgroundColor: levelColor }, glowStyle]} />
          
          <Animated.View style={[styles.starContainer, starStyle]}>
            <View style={[styles.levelBadge, { backgroundColor: levelColor }]}>
              <Animated.View style={badgeStyle}>
                <Feather name="star" size={48} color="#FFFFFF" />
              </Animated.View>
            </View>
          </Animated.View>

          <ThemedText style={styles.levelUpText}>LEVEL UP!</ThemedText>

          <View style={styles.levelRow}>
            <ThemedText style={[styles.oldLevel, { color: colors.textSecondary }]}>
              Lv.{oldLevel}
            </ThemedText>
            <Feather name="arrow-right" size={24} color={levelColor} style={{ marginHorizontal: Spacing.md }} />
            <ThemedText style={[styles.newLevel, { color: levelColor }]}>
              Lv.{newLevel}
            </ThemedText>
          </View>

          <ThemedText style={[styles.title, { color: colors.text }]}>
            {newTitle}
          </ThemedText>

          <ThemedText style={[styles.xpText, { color: colors.textSecondary }]}>
            Total XP: {totalXp.toLocaleString()}
          </ThemedText>

          {hasPerk ? (
            <View style={[styles.perkContainer, { backgroundColor: `${levelColor}20`, borderColor: levelColor }]}>
              <Feather name="gift" size={20} color={levelColor} />
              <View style={styles.perkTextContainer}>
                <ThemedText style={[styles.perkLabel, { color: levelColor }]}>
                  New Perk Unlocked!
                </ThemedText>
                <ThemedText style={[styles.perkText, { color: colors.text }]}>
                  {levelInfo.perk}
                </ThemedText>
              </View>
            </View>
          ) : null}

          <Animated.View style={buttonAnimStyle}>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: levelColor, opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={handleDismiss}
            >
              <ThemedText style={styles.buttonText}>Awesome!</ThemedText>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  content: {
    backgroundColor: '#1A1A2E',
    borderRadius: BorderRadius.lg,
    padding: Spacing['2xl'],
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    position: 'relative',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -50,
    left: -50,
    right: -50,
    height: 150,
    borderRadius: 100,
  },
  starContainer: {
    marginBottom: Spacing.lg,
  },
  levelBadge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  levelUpText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFD700',
    letterSpacing: 4,
    marginBottom: Spacing.md,
    textShadowColor: 'rgba(255, 215, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  oldLevel: {
    fontSize: 24,
    fontWeight: '700',
  },
  newLevel: {
    fontSize: 32,
    fontWeight: '900',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  xpText: {
    fontSize: 14,
    marginBottom: Spacing.lg,
  },
  perkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.xl,
    width: '100%',
  },
  perkTextContainer: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  perkLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  perkText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  button: {
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    minWidth: 160,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  confetti: {
    position: 'absolute',
    top: 0,
    borderRadius: 2,
  },
});
