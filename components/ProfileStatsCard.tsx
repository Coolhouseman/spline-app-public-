import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { GamificationService, GamificationProfile, LEVEL_INFO } from '@/services/gamification.service';

interface ProfileStatsCardProps {
  userId: string;
  compact?: boolean;
  showBadges?: boolean;
  onPress?: () => void;
}

const TIER_COLORS = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
};

export function ProfileStatsCard({ userId, compact = false, showBadges = true, onPress }: ProfileStatsCardProps) {
  const { theme: colors, isDark } = useTheme();
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const progressWidth = useSharedValue(0);
  const expandHeight = useSharedValue(0);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  useEffect(() => {
    if (profile) {
      progressWidth.value = withSpring(Math.min(profile.xp_progress_percent, 100) / 100, {
        damping: 15,
        stiffness: 100,
      });
    }
  }, [profile?.xp_progress_percent]);

  useEffect(() => {
    expandHeight.value = withTiming(expanded ? 1 : 0, { duration: 300 });
  }, [expanded]);

  const loadProfile = async () => {
    try {
      const data = await GamificationService.getProfile(userId);
      setProfile(data);
    } catch (error) {
      console.error('Failed to load gamification profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const progressAnimatedStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%`,
  }));

  const expandAnimatedStyle = useAnimatedStyle(() => ({
    maxHeight: interpolate(expandHeight.value, [0, 1], [0, 400]),
    opacity: expandHeight.value,
  }));

  const getLevelInfo = (level: number): { title: string; perk?: string } => {
    let currentInfo: { title: string; perk?: string } = { title: 'Newcomer' };
    for (const [lvl, info] of Object.entries(LEVEL_INFO).sort((a, b) => Number(a[0]) - Number(b[0]))) {
      if (Number(lvl) <= level) {
        currentInfo = info;
      }
    }
    return currentInfo;
  };

  const getNextPerkLevel = (level: number): { level: number; perk: string } | null => {
    for (const [lvl, info] of Object.entries(LEVEL_INFO).sort((a, b) => Number(a[0]) - Number(b[0]))) {
      if (Number(lvl) > level && info.perk) {
        return { level: Number(lvl), perk: info.perk };
      }
    }
    return null;
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.surface }]}>
        <View style={styles.loadingContainer}>
          <ThemedText style={styles.loadingText}>Loading stats...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!profile) {
    return null;
  }

  const levelInfo = getLevelInfo(profile.current_level);
  const nextPerk = getNextPerkLevel(profile.current_level);

  if (compact) {
    return (
      <Pressable onPress={onPress}>
        <View style={[styles.compactContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <View style={styles.compactLevelBadge}>
            <ThemedText style={[styles.compactLevel, { color: colors.primary }]}>
              {profile.current_level}
            </ThemedText>
          </View>
          <View style={styles.compactInfo}>
            <ThemedText style={[styles.compactTitle, { color: colors.text }]}>{levelInfo.title}</ThemedText>
            <View style={[styles.compactProgressBar, { backgroundColor: colors.border }]}>
              <Animated.View
                style={[
                  styles.compactProgressFill,
                  { backgroundColor: colors.primary },
                  progressAnimatedStyle,
                ]}
              />
            </View>
          </View>
          <ThemedText style={[styles.compactXP, { color: colors.textSecondary }]}>
            {profile.total_xp} XP
          </ThemedText>
        </View>
      </Pressable>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.surface }]}>
      <Pressable onPress={() => setExpanded(!expanded)}>
        <View style={styles.header}>
          <View style={styles.levelSection}>
            <View style={[styles.levelCircle, { borderColor: colors.primary }]}>
              <ThemedText style={[styles.levelNumber, { color: colors.primary }]}>
                {profile.current_level}
              </ThemedText>
            </View>
            <View style={styles.levelInfo}>
              <ThemedText style={[styles.title, { color: colors.text }]}>{levelInfo.title}</ThemedText>
              <ThemedText style={[styles.xpText, { color: colors.textSecondary }]}>
                {profile.total_xp.toLocaleString()} XP
              </ThemedText>
            </View>
          </View>
          <Feather
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.textSecondary}
          />
        </View>

        <View style={styles.progressSection}>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <Animated.View
              style={[
                styles.progressFill,
                { backgroundColor: colors.primary },
                progressAnimatedStyle,
              ]}
            />
          </View>
          <ThemedText style={[styles.progressText, { color: colors.textSecondary }]}>
            {Math.round(profile.xp_progress_percent)}% to Level {profile.current_level + 1}
          </ThemedText>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <ThemedText style={[styles.statValue, { color: colors.text }]}>
              {profile.current_streak}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
              Day Streak
            </ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <ThemedText style={[styles.statValue, { color: colors.text }]}>
              {profile.splits_created}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
              Splits Created
            </ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <ThemedText style={[styles.statValue, { color: colors.text }]}>
              {profile.splits_paid_on_time}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
              Paid On Time
            </ThemedText>
          </View>
        </View>
      </Pressable>

      <Animated.View style={[styles.expandedContent, expandAnimatedStyle]}>
        {nextPerk ? (
          <View style={[styles.perkPreview, { backgroundColor: colors.backgroundSecondary }]}>
            <Feather name="gift" size={18} color={colors.primary} />
            <View style={styles.perkInfo}>
              <ThemedText style={[styles.perkTitle, { color: colors.text }]}>
                Level {nextPerk.level} Perk
              </ThemedText>
              <ThemedText style={[styles.perkDescription, { color: colors.textSecondary }]}>
                {nextPerk.perk}
              </ThemedText>
            </View>
          </View>
        ) : null}

        {levelInfo.perk ? (
          <View style={[styles.currentPerk, { backgroundColor: colors.success + '15' }]}>
            <Feather name="check-circle" size={16} color={colors.success} />
            <ThemedText style={[styles.currentPerkText, { color: colors.success }]}>
              Unlocked: {levelInfo.perk}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.detailedStats}>
          <View style={styles.detailedStatRow}>
            <ThemedText style={[styles.detailedStatLabel, { color: colors.textSecondary }]}>
              Longest Streak
            </ThemedText>
            <ThemedText style={[styles.detailedStatValue, { color: colors.text }]}>
              {profile.longest_streak} days
            </ThemedText>
          </View>
          <View style={styles.detailedStatRow}>
            <ThemedText style={[styles.detailedStatLabel, { color: colors.textSecondary }]}>
              Total Split Volume
            </ThemedText>
            <ThemedText style={[styles.detailedStatValue, { color: colors.text }]}>
              ${profile.total_amount_split.toLocaleString()}
            </ThemedText>
          </View>
          <View style={styles.detailedStatRow}>
            <ThemedText style={[styles.detailedStatLabel, { color: colors.textSecondary }]}>
              Splits Completed as Leader
            </ThemedText>
            <ThemedText style={[styles.detailedStatValue, { color: colors.text }]}>
              {profile.splits_completed_as_creator}
            </ThemedText>
          </View>
        </View>

        {showBadges && profile.badges.length > 0 ? (
          <View style={styles.badgesSection}>
            <ThemedText style={[styles.badgesTitle, { color: colors.text }]}>
              Badges ({profile.badges.length})
            </ThemedText>
            <View style={styles.badgesGrid}>
              {profile.badges.slice(0, 6).map((badge) => (
                <View
                  key={badge.badge_id}
                  style={[
                    styles.badgeItem,
                    { backgroundColor: TIER_COLORS[badge.badge_tier] + '20' },
                  ]}
                >
                  <Feather
                    name={badge.badge_icon as any}
                    size={20}
                    color={TIER_COLORS[badge.badge_tier]}
                  />
                  <ThemedText
                    style={[styles.badgeName, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {badge.badge_name}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {profile.recent_xp.length > 0 ? (
          <View style={styles.recentXPSection}>
            <ThemedText style={[styles.recentXPTitle, { color: colors.text }]}>
              Recent Activity
            </ThemedText>
            {profile.recent_xp.slice(0, 3).map((item, index) => (
              <View key={index} style={styles.recentXPItem}>
                <View style={[styles.xpBadge, { backgroundColor: colors.primary + '20' }]}>
                  <ThemedText style={[styles.xpBadgeText, { color: colors.primary }]}>
                    +{item.xp_amount}
                  </ThemedText>
                </View>
                <ThemedText
                  style={[styles.recentXPDescription, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {item.description}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}
      </Animated.View>
    </ThemedView>
  );
}

export function LevelBadge({ level, size = 'small' }: { level: number; size?: 'small' | 'medium' }) {
  const { theme: colors } = useTheme();
  const badgeColor = GamificationService.getLevelColor(level);

  const sizeStyles = size === 'small' ? styles.levelBadgeSmall : styles.levelBadgeMedium;
  const textStyle = size === 'small' ? styles.levelBadgeTextSmall : styles.levelBadgeTextMedium;

  return (
    <View style={[sizeStyles, { backgroundColor: badgeColor + '30', borderColor: badgeColor }]}>
      <ThemedText style={[textStyle, { color: badgeColor }]}>{level}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: Spacing.lg,
  },
  loadingText: {
    ...Typography.caption,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  levelSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  levelCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelNumber: {
    ...Typography.h1,
    fontWeight: '700',
  },
  levelInfo: {
    gap: 2,
  },
  title: {
    ...Typography.h2,
  },
  xpText: {
    ...Typography.caption,
  },
  progressSection: {
    marginBottom: Spacing.lg,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    ...Typography.small,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    ...Typography.h2,
    fontWeight: '700',
  },
  statLabel: {
    ...Typography.small,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
  },
  expandedContent: {
    overflow: 'hidden',
  },
  perkPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.lg,
  },
  perkInfo: {
    flex: 1,
  },
  perkTitle: {
    ...Typography.caption,
    fontWeight: '600',
  },
  perkDescription: {
    ...Typography.small,
  },
  currentPerk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
  currentPerkText: {
    ...Typography.caption,
    fontWeight: '500',
  },
  detailedStats: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  detailedStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailedStatLabel: {
    ...Typography.caption,
  },
  detailedStatValue: {
    ...Typography.caption,
    fontWeight: '600',
  },
  badgesSection: {
    marginTop: Spacing.lg,
  },
  badgesTitle: {
    ...Typography.caption,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  badgeName: {
    ...Typography.small,
    fontWeight: '500',
  },
  recentXPSection: {
    marginTop: Spacing.lg,
  },
  recentXPTitle: {
    ...Typography.caption,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  recentXPItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  xpBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  xpBadgeText: {
    ...Typography.small,
    fontWeight: '600',
  },
  recentXPDescription: {
    ...Typography.small,
    flex: 1,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  compactLevelBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactLevel: {
    ...Typography.caption,
    fontWeight: '700',
  },
  compactInfo: {
    flex: 1,
    gap: 2,
  },
  compactTitle: {
    ...Typography.small,
    fontWeight: '600',
  },
  compactProgressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  compactProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  compactXP: {
    ...Typography.small,
  },
  levelBadgeSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  levelBadgeMedium: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  levelBadgeTextSmall: {
    fontSize: 10,
    fontWeight: '700',
  },
  levelBadgeTextMedium: {
    fontSize: 12,
    fontWeight: '700',
  },
});
