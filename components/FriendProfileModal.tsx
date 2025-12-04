import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Modal, Pressable, Image, ActivityIndicator, Platform, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { ThemedText } from './ThemedText';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { GamificationService, GamificationProfile, LEVEL_INFO } from '@/services/gamification.service';
import { LevelBadge } from './ProfileStatsCard';

interface FriendProfileModalProps {
  visible: boolean;
  onClose: () => void;
  friend: {
    id: string;
    name: string;
    unique_id?: string;
    profile_picture_url?: string;
  } | null;
}

const TIER_COLORS = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MODAL_WIDTH = Math.min(SCREEN_WIDTH - 48, 380);

export function FriendProfileModal({ visible, onClose, friend }: FriendProfileModalProps) {
  const { theme: colors, isDark } = useTheme();
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible && friend?.id) {
      loadFriendProfile();
      scale.value = withTiming(1, { 
        duration: 250, 
        easing: Easing.out(Easing.cubic) 
      });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      scale.value = withTiming(0.85, { duration: 150 });
      opacity.value = withTiming(0, { duration: 150 });
      setProfile(null);
    }
  }, [visible, friend?.id]);

  const loadFriendProfile = async () => {
    if (!friend?.id) return;
    
    setLoading(true);
    try {
      const data = await GamificationService.getProfile(friend.id);
      setProfile(data);
    } catch (error) {
      console.error('Failed to load friend profile:', error);
      setProfile(GamificationService.getDefaultProfile());
    } finally {
      setLoading(false);
    }
  };

  const handleCopyId = async () => {
    if (!friend?.unique_id) return;
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    await Clipboard.setStringAsync(friend.unique_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!friend) return null;

  const levelColor = profile ? GamificationService.getLevelColor(profile.current_level) : colors.primary;
  const levelInfo = profile ? LEVEL_INFO[profile.current_level] || LEVEL_INFO[1] : LEVEL_INFO[1];

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View style={[styles.overlayBg, overlayStyle]} />
        
        <Animated.View style={containerStyle}>
          <Pressable 
            style={[styles.content, { backgroundColor: colors.surface, width: MODAL_WIDTH }]} 
            onPress={() => {}}
          >
            <Pressable style={[styles.closeButton, { backgroundColor: colors.backgroundSecondary }]} onPress={onClose}>
              <Feather name="x" size={20} color={colors.textSecondary} />
            </Pressable>

            <View style={styles.profileHeader}>
              <View style={[styles.avatarContainer, { borderColor: levelColor }]}>
                {friend.profile_picture_url ? (
                  <Image source={{ uri: friend.profile_picture_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: levelColor + '20' }]}>
                    <ThemedText style={[styles.avatarInitial, { color: levelColor }]}>
                      {friend.name?.charAt(0)?.toUpperCase() || '?'}
                    </ThemedText>
                  </View>
                )}
              </View>

              <ThemedText style={[styles.name, { color: colors.text }]} numberOfLines={2}>
                {friend.name}
              </ThemedText>
              
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
                    Loading profile...
                  </ThemedText>
                </View>
              ) : profile ? (
                <>
                  <View style={styles.levelContainer}>
                    <LevelBadge level={profile.current_level} size="medium" showTitle />
                    <ThemedText style={[styles.levelSubtext, { color: colors.textSecondary }]}>
                      {profile.total_xp.toLocaleString()} XP earned
                    </ThemedText>
                  </View>
                </>
              ) : null}
            </View>

            {!loading && profile ? (
              <>
                <View style={[styles.statsContainer, { backgroundColor: colors.backgroundSecondary }]}>
                  <View style={styles.statItem}>
                    <View style={[styles.statIconContainer, { backgroundColor: colors.primary + '15' }]}>
                      <Feather name="layers" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.statTextContainer}>
                      <ThemedText style={[styles.statValue, { color: colors.text }]}>
                        {profile.splits_created}
                      </ThemedText>
                      <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                        Splits Created
                      </ThemedText>
                    </View>
                  </View>

                  <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

                  <View style={styles.statItem}>
                    <View style={[styles.statIconContainer, { backgroundColor: colors.success + '15' }]}>
                      <Feather name="check-circle" size={18} color={colors.success} />
                    </View>
                    <View style={styles.statTextContainer}>
                      <ThemedText style={[styles.statValue, { color: colors.text }]}>
                        {profile.splits_paid_on_time || 0}
                      </ThemedText>
                      <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                        Splits Paid
                      </ThemedText>
                    </View>
                  </View>

                  <View style={[styles.statDivider, { backgroundColor: colors.border }]} />

                  <View style={styles.statItem}>
                    <View style={[styles.statIconContainer, { backgroundColor: colors.warning + '15' }]}>
                      <Feather name="zap" size={18} color={colors.warning} />
                    </View>
                    <View style={styles.statTextContainer}>
                      <ThemedText style={[styles.statValue, { color: colors.text }]}>
                        {profile.current_streak}
                      </ThemedText>
                      <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                        Day Streak
                      </ThemedText>
                    </View>
                  </View>
                </View>

                {profile.badges.length > 0 ? (
                  <View style={styles.badgesSection}>
                    <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                      Badges Earned
                    </ThemedText>
                    <View style={styles.badgesRow}>
                      {profile.badges.slice(0, 4).map((badge) => (
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
                            style={[styles.badgeName, { color: TIER_COLORS[badge.badge_tier] }]}
                            numberOfLines={1}
                          >
                            {badge.badge_id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).split(' ').slice(0, 2).join(' ')}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </>
            ) : null}

            {friend.unique_id ? (
              <Pressable 
                style={[styles.idSection, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                onPress={handleCopyId}
              >
                <View style={styles.idContent}>
                  <ThemedText style={[styles.idLabel, { color: colors.textSecondary }]}>
                    Spline ID
                  </ThemedText>
                  <ThemedText style={[styles.idValue, { color: colors.text }]}>
                    {friend.unique_id}
                  </ThemedText>
                </View>
                <View style={[styles.copyButton, { backgroundColor: copied ? colors.success + '20' : colors.primary + '15' }]}>
                  <Feather 
                    name={copied ? 'check' : 'copy'} 
                    size={18} 
                    color={copied ? colors.success : colors.primary} 
                  />
                </View>
              </Pressable>
            ) : null}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  content: {
    borderRadius: BorderRadius.xl,
    paddingTop: Spacing.xl + Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    zIndex: 1,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 40,
    fontWeight: '700',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: Spacing.sm,
    textAlign: 'center',
    lineHeight: 30,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  loadingText: {
    fontSize: 14,
    marginTop: Spacing.sm,
  },
  levelContainer: {
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  levelSubtext: {
    fontSize: 13,
    marginTop: Spacing.sm,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  statTextContainer: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 24,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 16,
  },
  statDivider: {
    width: 1,
    height: 50,
    marginHorizontal: Spacing.xs,
  },
  badgesSection: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  badgeName: {
    fontSize: 12,
    fontWeight: '600',
  },
  idSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  idContent: {
    flex: 1,
  },
  idLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  idValue: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
  },
  copyButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.md,
  },
});
