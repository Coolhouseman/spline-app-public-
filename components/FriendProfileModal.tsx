import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Modal, Pressable, Image, ActivityIndicator, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { ThemedText } from './ThemedText';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { GamificationService, GamificationProfile, Badge, LEVEL_INFO } from '@/services/gamification.service';
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

export function FriendProfileModal({ visible, onClose, friend }: FriendProfileModalProps) {
  const { theme: colors, isDark } = useTheme();
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible && friend?.id) {
      loadFriendProfile();
      scale.value = withSpring(1, { damping: 15, stiffness: 150 });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      scale.value = withTiming(0, { duration: 150 });
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

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View style={[styles.overlayBg, overlayStyle]} />
        
        <Animated.View style={containerStyle}>
          <Pressable 
            style={[styles.content, { backgroundColor: colors.surface }]} 
            onPress={() => {}}
          >
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Feather name="x" size={24} color={colors.textSecondary} />
            </Pressable>

            <View style={styles.profileSection}>
              <View style={[styles.avatarContainer, { borderColor: levelColor }]}>
                {friend.profile_picture_url ? (
                  <Image source={{ uri: friend.profile_picture_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: levelColor + '25' }]}>
                    <ThemedText style={[styles.avatarInitial, { color: levelColor }]}>
                      {friend.name?.charAt(0)?.toUpperCase() || '?'}
                    </ThemedText>
                  </View>
                )}
              </View>

              <ThemedText style={[styles.name, { color: colors.text }]}>{friend.name}</ThemedText>
              
              {loading ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: Spacing.sm }} />
              ) : profile ? (
                <>
                  <View style={styles.levelRow}>
                    <LevelBadge level={profile.current_level} size="medium" showTitle />
                  </View>
                  
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <ThemedText style={[styles.statValue, { color: colors.text }]}>
                        {profile.total_xp.toLocaleString()}
                      </ThemedText>
                      <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                        Total XP
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
                        {profile.current_streak}
                      </ThemedText>
                      <ThemedText style={[styles.statLabel, { color: colors.textSecondary }]}>
                        Day Streak
                      </ThemedText>
                    </View>
                  </View>

                  {profile.badges.length > 0 ? (
                    <View style={styles.badgesSection}>
                      <ThemedText style={[styles.badgesTitle, { color: colors.textSecondary }]}>
                        Top Badges
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
                              size={16}
                              color={TIER_COLORS[badge.badge_tier]}
                            />
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </>
              ) : null}
            </View>

            {friend.unique_id ? (
              <Pressable 
                style={[styles.idSection, { backgroundColor: colors.backgroundSecondary }]}
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
                <View style={[styles.copyButton, { backgroundColor: colors.primary + '15' }]}>
                  <Feather 
                    name={copied ? 'check' : 'copy'} 
                    size={16} 
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
    padding: Spacing.xl,
  },
  overlayBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  content: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 340,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    zIndex: 1,
    padding: Spacing.xs,
  },
  profileSection: {
    alignItems: 'center',
    paddingTop: Spacing.md,
  },
  avatarContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    overflow: 'hidden',
    marginBottom: Spacing.md,
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
    fontSize: 36,
    fontWeight: '700',
  },
  name: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  levelRow: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 30,
  },
  badgesSection: {
    alignItems: 'center',
    width: '100%',
  },
  badgesTitle: {
    fontSize: 12,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  badgeItem: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  idSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  idContent: {
    flex: 1,
  },
  idLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  idValue: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
  copyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.md,
  },
});
