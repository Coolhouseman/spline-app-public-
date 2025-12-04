import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, Modal } from 'react-native';
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
import { useLevelUp } from '@/contexts/LevelUpContext';
import { GamificationService, GamificationProfile, LEVEL_INFO } from '@/services/gamification.service';
import { VoucherClaimModal } from './VoucherClaimModal';

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

const STAT_HELP_INFO = {
  streak: {
    title: 'Day Streak',
    description: 'Your CURRENT run of consecutive days using Spline. This counter resets back to zero if you miss a day of activity (creating or paying splits).',
    howToEarn: 'Use Spline every day to keep your streak alive. You earn 20 bonus XP at 7 days and 100 XP at 30 days!',
    example: 'If you used Spline Mon-Wed-Thu-Fri, your streak is 3 (Thu missed reset it, Fri started fresh).',
  },
  splitsCreated: {
    title: 'Splits Created',
    description: 'The number of split events you have organized. Each time you initiate a new bill split with friends, this count increases by one.',
    howToEarn: 'Start a split anytime you share expenses - dinner, groceries, trips, rent. Earn 25-40 XP per split!',
    example: 'Dinner with 3 friends = 1 split. Movie night tomorrow = 2 splits total.',
  },
  paidOnTime: {
    title: 'Paid On Time',
    description: 'How many times you paid your share within 24 hours of receiving a split request. A key trust indicator visible to friends.',
    howToEarn: 'Pay quickly when friends add you to splits. Paying within 1 hour earns 35 XP (vs 20 XP for slower)!',
    example: 'Friend splits lunch at 12pm, you pay by 1pm = Paid On Time. Pay next week = not counted.',
  },
  longestStreak: {
    title: 'Longest Streak',
    description: 'Your ALL-TIME BEST streak record. Unlike Day Streak, this number never resets - it is your personal best achievement on Spline.',
    howToEarn: 'Keep your Day Streak going to beat this record! Unlock special badges at 7 days and 30 days.',
    example: 'If your Day Streak once hit 15 but is now 3, your Longest Streak stays 15 forever.',
  },
  splitVolume: {
    title: 'Total Split Volume',
    description: 'The total DOLLAR AMOUNT of all splits you have been part of (as creator or participant). This is about money moved, not count of splits.',
    howToEarn: 'Participate in more splits or splits with larger amounts. A $200 dinner contributes more than a $10 coffee!',
    example: '$50 dinner + $30 groceries + $120 trip = $200 Total Volume. Splits Created would be 3.',
  },
  splitsAsLeader: {
    title: 'Splits Completed as Leader',
    description: 'How many splits YOU created where everyone paid 100%. Shows your effectiveness at organizing and collecting payments.',
    howToEarn: 'Create splits and encourage friends to pay. You earn 50 bonus XP each time a split you created is fully paid!',
    example: 'You split dinner with 4 friends, all 4 pay = +1 completed. If 1 friend never pays = not counted.',
  },
};

export function ProfileStatsCard({ userId, compact = false, showBadges = true, onPress }: ProfileStatsCardProps) {
  const { theme: colors, isDark } = useTheme();
  const { xpRefreshTrigger } = useLevelUp();
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [helpModal, setHelpModal] = useState<{ visible: boolean; stat: keyof typeof STAT_HELP_INFO | null }>({
    visible: false,
    stat: null,
  });
  const [voucherModal, setVoucherModal] = useState(false);

  const progressWidth = useSharedValue(0);
  const expandHeight = useSharedValue(0);

  useEffect(() => {
    loadProfile();
  }, [userId, xpRefreshTrigger]);

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
            <View style={styles.statLabelRow}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                Day Streak
              </ThemedText>
              <HelpIcon onPress={() => setHelpModal({ visible: true, stat: 'streak' })} />
            </View>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <ThemedText style={[styles.statValue, { color: colors.text }]}>
              {profile.splits_created}
            </ThemedText>
            <View style={styles.statLabelRow}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                Splits Created
              </ThemedText>
              <HelpIcon onPress={() => setHelpModal({ visible: true, stat: 'splitsCreated' })} />
            </View>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <ThemedText style={[styles.statValue, { color: colors.text }]}>
              {profile.splits_paid_on_time}
            </ThemedText>
            <View style={styles.statLabelRow}>
              <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                Paid On Time
              </ThemedText>
              <HelpIcon onPress={() => setHelpModal({ visible: true, stat: 'paidOnTime' })} />
            </View>
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
            <View style={styles.currentPerkContent}>
              <ThemedText style={[styles.currentPerkText, { color: colors.success }]}>
                Unlocked: {levelInfo.perk}
              </ThemedText>
              {profile.current_level >= 10 && levelInfo.perk.includes('Voucher') ? (
                <Pressable 
                  style={[styles.claimButton, { backgroundColor: colors.primary }]}
                  onPress={() => setVoucherModal(true)}
                >
                  <Feather name="gift" size={14} color="#fff" />
                  <ThemedText style={styles.claimButtonText}>Claim</ThemedText>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.detailedStats}>
          <View style={styles.detailedStatRow}>
            <View style={styles.detailedStatLabelRow}>
              <ThemedText style={[styles.detailedStatLabel, { color: colors.textSecondary }]}>
                Longest Streak
              </ThemedText>
              <HelpIcon onPress={() => setHelpModal({ visible: true, stat: 'longestStreak' })} />
            </View>
            <ThemedText style={[styles.detailedStatValue, { color: colors.text }]}>
              {profile.longest_streak} days
            </ThemedText>
          </View>
          <View style={styles.detailedStatRow}>
            <View style={styles.detailedStatLabelRow}>
              <ThemedText style={[styles.detailedStatLabel, { color: colors.textSecondary }]}>
                Total Split Volume
              </ThemedText>
              <HelpIcon onPress={() => setHelpModal({ visible: true, stat: 'splitVolume' })} />
            </View>
            <ThemedText style={[styles.detailedStatValue, { color: colors.text }]}>
              ${profile.total_amount_split.toLocaleString()}
            </ThemedText>
          </View>
          <View style={styles.detailedStatRow}>
            <View style={styles.detailedStatLabelRow}>
              <ThemedText style={[styles.detailedStatLabel, { color: colors.textSecondary }]}>
                Splits Completed as Leader
              </ThemedText>
              <HelpIcon onPress={() => setHelpModal({ visible: true, stat: 'splitsAsLeader' })} />
            </View>
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

      {helpModal.stat ? (
        <StatHelpModal
          visible={helpModal.visible}
          onClose={() => setHelpModal({ visible: false, stat: null })}
          title={STAT_HELP_INFO[helpModal.stat].title}
          description={STAT_HELP_INFO[helpModal.stat].description}
          howToEarn={STAT_HELP_INFO[helpModal.stat].howToEarn}
          example={STAT_HELP_INFO[helpModal.stat].example}
        />
      ) : null}

      <VoucherClaimModal
        visible={voucherModal}
        onClose={() => setVoucherModal(false)}
        userId={userId}
        voucherType="dinner_voucher"
        voucherValue="$50 Dinner Voucher"
        levelRequired={10}
      />
    </ThemedView>
  );
}

export function LevelBadge({ level, size = 'small', showTitle = false, variant = 'default' }: { 
  level: number; 
  size?: 'small' | 'medium'; 
  showTitle?: boolean;
  variant?: 'default' | 'compact' | 'pill';
}) {
  const { theme: colors } = useTheme();
  const badgeColor = GamificationService.getLevelColor(level);
  const title = GamificationService.getTitleForLevel(level);

  const sizeStyles = size === 'small' ? styles.levelBadgeSmall : styles.levelBadgeMedium;
  const textStyle = size === 'small' ? styles.levelBadgeTextSmall : styles.levelBadgeTextMedium;

  // Pill variant - elegant minimal display for participant lists
  if (variant === 'pill') {
    return (
      <View style={[styles.levelBadgePill, { backgroundColor: badgeColor + '20' }]}>
        <View style={[styles.levelBadgePillDot, { backgroundColor: badgeColor }]} />
        <ThemedText style={[styles.levelBadgePillText, { color: badgeColor }]}>
          Lv.{level}
        </ThemedText>
      </View>
    );
  }

  // Compact variant - just shows the level circle with title below it
  if (variant === 'compact') {
    return (
      <View style={styles.levelBadgeCompact}>
        <View style={[styles.levelBadgeCompactCircle, { backgroundColor: badgeColor + '25', borderColor: badgeColor }]}>
          <ThemedText style={[styles.levelBadgeCompactNumber, { color: badgeColor }]}>{level}</ThemedText>
        </View>
        <ThemedText style={[styles.levelBadgeCompactTitle, { color: badgeColor }]} numberOfLines={1}>
          {title}
        </ThemedText>
      </View>
    );
  }

  if (showTitle) {
    return (
      <View style={styles.levelBadgeWithTitle}>
        <View style={[sizeStyles, { backgroundColor: badgeColor + '30', borderColor: badgeColor }]}>
          <ThemedText style={[textStyle, { color: badgeColor }]}>{level}</ThemedText>
        </View>
        <ThemedText style={[styles.levelTitleText, { color: badgeColor }]}>{title}</ThemedText>
      </View>
    );
  }

  return (
    <View style={[sizeStyles, { backgroundColor: badgeColor + '30', borderColor: badgeColor }]}>
      <ThemedText style={[textStyle, { color: badgeColor }]}>{level}</ThemedText>
    </View>
  );
}

interface StatHelpModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  description: string;
  howToEarn?: string;
  example?: string;
}

export function StatHelpModal({ visible, onClose, title, description, howToEarn, example }: StatHelpModalProps) {
  const { theme: colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.helpModalOverlay} onPress={onClose}>
        <Pressable style={[styles.helpModalContent, { backgroundColor: colors.surface }]} onPress={() => {}}>
          <View style={styles.helpModalHeader}>
            <ThemedText style={[styles.helpModalTitle, { color: colors.text }]}>{title}</ThemedText>
            <Pressable onPress={onClose} style={styles.helpCloseBtn}>
              <Feather name="x" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ThemedText style={[styles.helpModalDescription, { color: colors.textSecondary }]}>
            {description}
          </ThemedText>
          {example ? (
            <View style={[styles.helpExampleSection, { backgroundColor: colors.backgroundSecondary }]}>
              <Feather name="info" size={14} color={colors.textSecondary} />
              <ThemedText style={[styles.helpExampleText, { color: colors.textSecondary }]}>
                {example}
              </ThemedText>
            </View>
          ) : null}
          {howToEarn ? (
            <View style={[styles.helpEarnSection, { backgroundColor: colors.primary + '15' }]}>
              <Feather name="zap" size={16} color={colors.primary} />
              <ThemedText style={[styles.helpEarnText, { color: colors.primary }]}>
                {howToEarn}
              </ThemedText>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface HelpIconProps {
  onPress: () => void;
  size?: 'small' | 'medium';
}

export function HelpIcon({ onPress, size = 'small' }: HelpIconProps) {
  const { theme: colors } = useTheme();
  const iconSize = size === 'small' ? 12 : 14;
  const containerSize = size === 'small' ? 16 : 20;
  
  return (
    <Pressable 
      onPress={onPress} 
      style={[
        styles.helpIconBtn, 
        { 
          width: containerSize, 
          height: containerSize,
          borderRadius: containerSize / 2,
          backgroundColor: colors.textSecondary + '15',
        }
      ]} 
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <ThemedText style={[styles.helpIconText, { color: colors.textSecondary, fontSize: iconSize - 2 }]}>?</ThemedText>
    </Pressable>
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
    fontSize: 11,
    textAlign: 'center',
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
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
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
  currentPerkContent: {
    flex: 1,
    gap: Spacing.sm,
  },
  currentPerkText: {
    ...Typography.caption,
    fontWeight: '500',
  },
  claimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  claimButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
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
  detailedStatLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  levelBadgeWithTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  levelTitleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  levelBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  levelBadgePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  levelBadgePillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  levelBadgeCompact: {
    alignItems: 'center',
    gap: 2,
  },
  levelBadgeCompactCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelBadgeCompactNumber: {
    fontSize: 11,
    fontWeight: '700',
  },
  levelBadgeCompactTitle: {
    fontSize: 9,
    fontWeight: '600',
    maxWidth: 60,
    textAlign: 'center',
  },
  helpModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  helpModalContent: {
    width: '100%',
    maxWidth: 340,
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
  },
  helpModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  helpModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  helpModalDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  helpCloseBtn: {
    padding: Spacing.xs,
    marginLeft: Spacing.sm,
  },
  helpExampleSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  helpExampleText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
    fontStyle: 'italic',
  },
  helpEarnSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  helpEarnText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
    fontWeight: '500',
  },
  helpIconBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  helpIconText: {
    fontWeight: '600',
  },
});
