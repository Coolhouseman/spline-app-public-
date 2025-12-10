import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Modal, Pressable, Image, ActivityIndicator, Platform, Dimensions, Alert, TextInput } from 'react-native';
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
import { FriendsService } from '@/services/friends.service';
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
  userId?: string;
  onBlock?: () => void;
}

const TIER_COLORS = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
};

const REPORT_REASONS = [
  { id: 'spam', label: 'Spam or scam' },
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'fraud', label: 'Fraud or financial abuse' },
  { id: 'other', label: 'Other' },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MODAL_WIDTH = Math.min(SCREEN_WIDTH - 48, 380);

export function FriendProfileModal({ visible, onClose, friend, userId, onBlock }: FriendProfileModalProps) {
  const { theme: colors, isDark } = useTheme();
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showingReportView, setShowingReportView] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      setSelectedReason(null);
      setCustomReason('');
      setShowingReportView(false);
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

  const handleBlock = () => {
    if (!userId || !friend) return;
    
    const friendName = friend.name;
    const friendId = friend.id;
    
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${friendName}? They won't be able to send you friend requests or include you in splits.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              setSubmitting(true);
              await FriendsService.blockUser(userId, friendId);
              setSubmitting(false);
              
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              
              onClose();
              onBlock?.();
              
              setTimeout(() => {
                Alert.alert('User Blocked', `${friendName} has been blocked`);
              }, 100);
            } catch (error: any) {
              setSubmitting(false);
              Alert.alert('Error', error.message || 'Failed to block user');
            }
          },
        },
      ]
    );
  };

  const handleReportPress = () => {
    console.log('[FriendProfileModal] Report button pressed');
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // Switch to report view within the same modal
    setShowingReportView(true);
  };
  
  const handleBackToProfile = () => {
    setShowingReportView(false);
    setSelectedReason(null);
    setCustomReason('');
  };

  const handleSubmitReport = async () => {
    if (!userId || !friend || !selectedReason) return;
    
    const friendId = friend.id;
    const friendName = friend.name;
    
    let reason = selectedReason === 'other' 
      ? (customReason.trim() || 'Other reason not specified')
      : REPORT_REASONS.find(r => r.id === selectedReason)?.label || selectedReason;
    
    if (reason.length < 10) {
      reason = `${reason} - User reported`;
    }
    
    try {
      setSubmitting(true);
      await FriendsService.reportUser(userId, friendId, reason);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setShowingReportView(false);
      setSelectedReason(null);
      setCustomReason('');
      Alert.alert(
        'Report Submitted',
        'Thank you for your report. Our team will review it shortly.',
        [{ text: 'OK', onPress: onClose }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
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
    <>
      <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
        <Pressable style={styles.overlay} onPress={onClose}>
          <Animated.View style={[styles.overlayBg, overlayStyle]} />
          
          <Animated.View style={containerStyle}>
            <Pressable 
              style={[styles.content, { backgroundColor: colors.surface, width: MODAL_WIDTH }]} 
              onPress={() => {}}
            >
              {showingReportView ? (
                <>
                  <Pressable 
                    style={[styles.closeButton, { backgroundColor: colors.backgroundSecondary }]} 
                    onPress={handleBackToProfile}
                  >
                    <Feather name="arrow-left" size={20} color={colors.textSecondary} />
                  </Pressable>

                  <View style={styles.reportHeader}>
                    <ThemedText style={[styles.reportTitle, { color: colors.text }]}>
                      Report {friend.name}
                    </ThemedText>
                  </View>

                  <ThemedText style={[styles.reportSubtitle, { color: colors.textSecondary }]}>
                    Why are you reporting this user?
                  </ThemedText>

                  <View style={styles.reasonsList}>
                    {REPORT_REASONS.map((reason) => (
                      <Pressable
                        key={reason.id}
                        style={[
                          styles.reasonItem,
                          { 
                            backgroundColor: selectedReason === reason.id ? colors.primary + '15' : colors.backgroundSecondary,
                            borderColor: selectedReason === reason.id ? colors.primary : colors.border,
                          }
                        ]}
                        onPress={() => setSelectedReason(reason.id)}
                      >
                        <View style={[
                          styles.radioButton,
                          { borderColor: selectedReason === reason.id ? colors.primary : colors.textSecondary }
                        ]}>
                          {selectedReason === reason.id ? (
                            <View style={[styles.radioButtonInner, { backgroundColor: colors.primary }]} />
                          ) : null}
                        </View>
                        <ThemedText style={[styles.reasonText, { color: colors.text }]}>
                          {reason.label}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>

                  {selectedReason === 'other' ? (
                    <TextInput
                      style={[
                        styles.customReasonInput,
                        { 
                          backgroundColor: colors.backgroundSecondary, 
                          color: colors.text,
                          borderColor: colors.border,
                        }
                      ]}
                      placeholder="Please describe the issue..."
                      placeholderTextColor={colors.textSecondary}
                      value={customReason}
                      onChangeText={setCustomReason}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  ) : null}

                  <Pressable
                    style={({ pressed }) => [
                      styles.submitButton,
                      { 
                        backgroundColor: selectedReason ? colors.primary : colors.backgroundSecondary,
                        opacity: pressed && selectedReason ? 0.7 : 1 
                      }
                    ]}
                    onPress={handleSubmitReport}
                    disabled={!selectedReason || submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <ThemedText style={[
                        styles.submitButtonText, 
                        { color: selectedReason ? '#FFFFFF' : colors.textSecondary }
                      ]}>
                        Submit Report
                      </ThemedText>
                    )}
                  </Pressable>
                </>
              ) : (
                <>
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

                  {userId ? (
                    <View style={styles.actionButtons}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.actionButton,
                          { backgroundColor: colors.backgroundSecondary, opacity: pressed ? 0.7 : 1 }
                        ]}
                        onPress={handleReportPress}
                        disabled={submitting}
                      >
                        <Feather name="flag" size={18} color={colors.warning} />
                        <ThemedText style={[styles.actionButtonText, { color: colors.warning }]}>
                          Report
                        </ThemedText>
                      </Pressable>
                      
                      <Pressable
                        style={({ pressed }) => [
                          styles.actionButton,
                          { backgroundColor: colors.danger + '15', opacity: pressed ? 0.7 : 1 }
                        ]}
                        onPress={handleBlock}
                        disabled={submitting}
                      >
                        <Feather name="slash" size={18} color={colors.danger} />
                        <ThemedText style={[styles.actionButtonText, { color: colors.danger }]}>
                          Block
                        </ThemedText>
                      </Pressable>
                    </View>
                  ) : null}
                </>
              )}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
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
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  reportContent: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    maxHeight: '80%',
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  reportTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  reportSubtitle: {
    fontSize: 14,
    marginBottom: Spacing.lg,
  },
  reasonsList: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  reasonText: {
    fontSize: 15,
    flex: 1,
  },
  customReasonInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    fontSize: 15,
    minHeight: 100,
    marginBottom: Spacing.lg,
  },
  submitButton: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
