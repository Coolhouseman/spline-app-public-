import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Pressable, FlatList, Image, TextInput, RefreshControl, Alert, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { LevelBadge } from '@/components/ProfileStatsCard';
import { FriendProfileModal } from '@/components/FriendProfileModal';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { FriendsService } from '@/services/friends.service';
import { GamificationService } from '@/services/gamification.service';
import { ReferralsService } from '@/services/referrals.service';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeBottomTabBarHeight } from '@/hooks/useSafeBottomTabBarHeight';
import type { BlockedUser } from '@/shared/types';

type Props = NativeStackScreenProps<any, 'Friends'>;

interface PendingRequest {
  id: string;
  user_id: string;
  friend_id: string;
  status: string;
  requester: {
    id: string;
    unique_id: string;
    name: string;
    email: string;
    profile_picture?: string;
    bio?: string;
  };
}

interface FriendWithDetails {
  id: string;
  user_id: string;
  friend_id: string;
  status: string;
  friend_details: {
    id: string;
    unique_id: string;
    name: string;
    email: string;
    profile_picture?: string;
    bio?: string;
  };
  gamification?: {
    current_level: number;
    total_xp: number;
  } | null;
}

interface SentRequest {
  id: string;
  user_id: string;
  friend_id: string;
  status: string;
  created_at: string;
  last_reminder_at?: string;
  recipient: {
    id: string;
    unique_id: string;
    name: string;
    email: string;
    profile_picture?: string;
    bio?: string;
  };
}

const REMINDER_COOLDOWN_HOURS = 24;

function getResendStatus(request: SentRequest): { canResend: boolean; hoursRemaining: number } {
  const lastSentAt = request.last_reminder_at || request.created_at;
  const hoursSinceSent = (Date.now() - new Date(lastSentAt).getTime()) / (1000 * 60 * 60);
  const hoursRemaining = Math.max(0, Math.ceil(REMINDER_COOLDOWN_HOURS - hoursSinceSent));
  return {
    canResend: hoursSinceSent >= REMINDER_COOLDOWN_HOURS,
    hoursRemaining,
  };
}

interface SelectedFriend {
  id: string;
  name: string;
  unique_id?: string;
  profile_picture_url?: string;
}

export default function FriendsScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useSafeBottomTabBarHeight();
  const [friends, setFriends] = useState<FriendWithDetails[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<SentRequest[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<SelectedFriend | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [referralEmail, setReferralEmail] = useState('');
  const [sendingReferral, setSendingReferral] = useState(false);
  const [referredCount, setReferredCount] = useState(0);
  const [showReferralHelp, setShowReferralHelp] = useState(false);

  const handleFriendPress = (details: FriendWithDetails['friend_details']) => {
    if (!details) return;
    setSelectedFriend({
      id: details.id,
      name: details.name,
      unique_id: details.unique_id,
      profile_picture_url: details.profile_picture,
    });
    setProfileModalVisible(true);
  };

  const gamificationCacheRef = React.useRef<Map<string, { current_level: number; total_xp: number } | null>>(new Map());

  const loadData = useCallback(async (showLoading = true, skipGamification = false) => {
    if (!user?.id) return;
    
    try {
      if (showLoading) setLoading(true);
      const [friendsData, requestsData, sentData, blockedData] = await Promise.all([
        FriendsService.getFriends(user.id),
        FriendsService.getPendingRequests(user.id),
        FriendsService.getSentPendingRequests(user.id),
        FriendsService.getBlockedUsers(user.id).catch(() => []),
      ]);
      
      const blockedIds = new Set(blockedData.map(b => b.blocked_user_id));
      setBlockedUsers(blockedData);
      setBlockedUserIds(blockedIds);
      
      let friendsWithGamification: FriendWithDetails[];
      
      if (skipGamification) {
        friendsWithGamification = (friendsData as FriendWithDetails[]).map((friend) => {
          const cachedGamification = gamificationCacheRef.current.get(friend.friend_details.id);
          return { ...friend, gamification: cachedGamification || null };
        });
      } else {
        friendsWithGamification = await Promise.all(
          (friendsData as FriendWithDetails[]).map(async (friend) => {
            try {
              const gamification = await GamificationService.getProfile(friend.friend_details.id);
              gamificationCacheRef.current.set(friend.friend_details.id, gamification);
              return { ...friend, gamification };
            } catch {
              return { ...friend, gamification: null };
            }
          })
        );
      }
      
      setFriends(friendsWithGamification);
      setPendingRequests(requestsData as unknown as PendingRequest[]);
      setSentRequests(sentData as unknown as SentRequest[]);
      const myProfile = await GamificationService.getProfile(user.id);
      setReferredCount(myProfile?.friends_referred || 0);
    } catch (error) {
      console.error('Failed to load friends:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation, loadData]);

  // Subscribe to realtime updates for friend requests
  useEffect(() => {
    if (!user?.id) return;

    console.log('[FriendsScreen] Setting up realtime subscription for user:', user.id);
    const subscription = FriendsService.subscribeToFriendUpdates(
      user.id,
      () => {
        console.log('[FriendsScreen] Realtime update received, refreshing data (using cached gamification)');
        loadData(false, true);
      }
    );

    return () => {
      console.log('[FriendsScreen] Cleaning up realtime subscription');
      subscription.unsubscribe();
    };
  }, [user?.id, loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleAcceptRequest = async (requestId: string) => {
    if (!user?.id) return;
    try {
      await FriendsService.acceptFriendRequest(user.id, requestId);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to accept request');
    }
  };

  const handleDeclineRequest = async (requestId: string) => {
    if (!user?.id) return;
    try {
      await FriendsService.declineFriendRequest(user.id, requestId);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to decline request');
    }
  };

  const handleResendRequest = async (request: SentRequest) => {
    if (!user?.id || !request.recipient?.unique_id) return;
    
    const { canResend, hoursRemaining } = getResendStatus(request);
    if (!canResend) {
      Alert.alert('Please Wait', `You can resend in ${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''}`);
      return;
    }
    
    try {
      await FriendsService.sendFriendRequest(user.id, request.recipient.unique_id);
      Alert.alert('Success', 'Reminder sent successfully!');
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend request');
    }
  };

  const handleUnblock = async (blockedUserId: string, userName: string) => {
    if (!user?.id) return;
    
    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock ${userName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            try {
              await FriendsService.unblockUser(user.id, blockedUserId);
              Alert.alert('Success', `${userName} has been unblocked`);
              loadData();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to unblock user');
            }
          },
        },
      ]
    );
  };

  const filteredFriends = friends.filter(f => {
    const friendId = f.friend_details?.id || '';
    if (blockedUserIds.has(friendId)) return false;
    const name = f.friend_details?.name || '';
    const uniqueId = f.friend_details?.unique_id || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      uniqueId.includes(searchQuery);
  });

  const handleSendReferral = async () => {
    const email = referralEmail.trim().toLowerCase();
    if (!email || !email.includes('@') || !email.includes('.')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setSendingReferral(true);
    try {
      await ReferralsService.sendInvite(email);
      setReferralEmail('');
      Alert.alert(
        'Invite Sent',
        'Your referral invite has been sent successfully.\n\nIf they have not received it, please ask them to check their Spam or Junk folder.'
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send referral invite.');
    } finally {
      setSendingReferral(false);
    }
  };

  const filteredPendingRequests = pendingRequests.filter(r => {
    return !blockedUserIds.has(r.requester?.id || '');
  });

  const filteredSentRequests = sentRequests.filter(r => {
    return !blockedUserIds.has(r.recipient?.id || '');
  });

  const renderFriend = ({ item }: { item: FriendWithDetails }) => {
    const details = item.friend_details;
    if (!details) return null;
    
    return (
      <View style={[styles.friendCard, { borderBottomColor: theme.border }]}>
        <View style={[styles.avatar, { backgroundColor: theme.backgroundSecondary }]}>
          {details.profile_picture ? (
            <Image source={{ uri: details.profile_picture }} style={styles.avatarImage} />
          ) : (
            <Feather name="user" size={24} color={theme.textSecondary} />
          )}
        </View>
        <View style={styles.friendInfo}>
          <View style={styles.friendNameRow}>
            <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
              {details.name}
            </ThemedText>
            {item.gamification?.current_level ? (
              <LevelBadge level={item.gamification.current_level} size="small" showTitle />
            ) : null}
          </View>
          <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
            ID: {details.unique_id}
          </ThemedText>
        </View>
      </View>
    );
  };

  const renderPendingRequest = (request: PendingRequest) => {
    const requester = request.requester;
    const requesterName = requester?.name || 'Someone';
    const requesterPicture = requester?.profile_picture;
    
    return (
      <View 
        key={request.id} 
        style={[styles.requestCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <View style={[styles.avatar, { backgroundColor: theme.backgroundSecondary }]}>
          {requesterPicture ? (
            <Image source={{ uri: requesterPicture }} style={styles.avatarImage} />
          ) : (
            <Feather name="user" size={24} color={theme.textSecondary} />
          )}
        </View>
        <View style={styles.friendInfo}>
          <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
            {requesterName}
          </ThemedText>
          <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
            Wants to be your friend
          </ThemedText>
        </View>
        <View style={styles.requestActions}>
          <Pressable
            style={({ pressed }) => [
              styles.declineBtn,
              { borderColor: theme.danger, opacity: pressed ? 0.7 : 1 }
            ]}
            onPress={() => handleDeclineRequest(request.id)}
          >
            <Feather name="x" size={18} color={theme.danger} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.acceptBtn,
              { backgroundColor: theme.success, opacity: pressed ? 0.7 : 1 }
            ]}
            onPress={() => handleAcceptRequest(request.id)}
          >
            <Feather name="check" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    );
  };

  const renderSentRequest = (request: SentRequest) => {
    const recipient = request.recipient;
    const recipientName = recipient?.name || 'Someone';
    const recipientPicture = recipient?.profile_picture;
    const { canResend, hoursRemaining } = getResendStatus(request);
    
    return (
      <View 
        key={request.id} 
        style={[styles.requestCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
      >
        <View style={[styles.avatar, { backgroundColor: theme.backgroundSecondary }]}>
          {recipientPicture ? (
            <Image source={{ uri: recipientPicture }} style={styles.avatarImage} />
          ) : (
            <Feather name="user" size={24} color={theme.textSecondary} />
          )}
        </View>
        <View style={styles.friendInfo}>
          <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
            {recipientName}
          </ThemedText>
          <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
            ID: {recipient?.unique_id}
          </ThemedText>
        </View>
        <View style={styles.sentRequestActions}>
          <Pressable
            style={({ pressed }) => [
              styles.resendBtn,
              { 
                backgroundColor: canResend ? theme.primary : theme.backgroundSecondary,
                opacity: pressed ? 0.7 : 1 
              }
            ]}
            onPress={() => handleResendRequest(request)}
          >
            <Feather 
              name="send" 
              size={14} 
              color={canResend ? '#FFFFFF' : theme.textSecondary} 
            />
            <ThemedText 
              style={[
                Typography.caption, 
                { 
                  color: canResend ? '#FFFFFF' : theme.textSecondary, 
                  fontWeight: '600',
                  marginLeft: 4 
                }
              ]}
            >
              {canResend ? 'Resend' : `${hoursRemaining}h`}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.xl }]}>
      <View style={styles.header}>
        <ThemedText style={[Typography.h1, { color: theme.text }]}>Friends</ThemedText>
        <Pressable
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: theme.primary, opacity: pressed ? 0.7 : 1 }
          ]}
          onPress={() => navigation.navigate('AddFriend')}
        >
          <Feather name="user-plus" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={[styles.searchBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Feather name="search" size={20} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search by name or ID"
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={[styles.referralCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.referralHeader}>
          <ThemedText style={[Typography.h2, { color: theme.text }]}>Refer a friend</ThemedText>
          <Pressable
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
            onPress={() => setShowReferralHelp((prev) => !prev)}
          >
            <View style={[styles.helpIcon, { borderColor: theme.border }]}>
              <ThemedText style={[Typography.small, { color: theme.textSecondary, fontWeight: '700' }]}>?</ThemedText>
            </View>
          </Pressable>
        </View>
        <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
          Successful referrals: {referredCount}
        </ThemedText>
        {showReferralHelp ? (
          <ThemedText style={[Typography.small, { color: theme.textSecondary, marginTop: Spacing.sm }]}>
            Earn +40 XP for both of you when your invited friend signs up and successfully binds their payment card.
          </ThemedText>
        ) : null}
        <View style={styles.referralInputRow}>
          <TextInput
            style={[styles.referralInput, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, color: theme.text }]}
            placeholder="Friend's email"
            placeholderTextColor={theme.textSecondary}
            value={referralEmail}
            onChangeText={setReferralEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Pressable
            style={({ pressed }) => [
              styles.referralButton,
              { backgroundColor: theme.primary, opacity: pressed || sendingReferral ? 0.7 : 1 },
            ]}
            onPress={handleSendReferral}
            disabled={sendingReferral}
          >
            <ThemedText style={[Typography.caption, { color: '#FFFFFF', fontWeight: '600' }]}>
              {sendingReferral ? 'Sending...' : 'Invite'}
            </ThemedText>
          </Pressable>
        </View>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBarHeight + Spacing.xl + Spacing.fabSize }
        ]}
      >
        {filteredPendingRequests.length > 0 ? (
          <View style={styles.section}>
            <ThemedText style={[Typography.h2, { color: theme.text, marginBottom: Spacing.md }]}>
              Friend Requests ({filteredPendingRequests.length})
            </ThemedText>
            {filteredPendingRequests.map(renderPendingRequest)}
          </View>
        ) : null}

        {filteredSentRequests.length > 0 ? (
          <View style={styles.section}>
            <ThemedText style={[Typography.h2, { color: theme.text, marginBottom: Spacing.md }]}>
              Sent Requests ({filteredSentRequests.length})
            </ThemedText>
            {filteredSentRequests.map(renderSentRequest)}
          </View>
        ) : null}

        {filteredFriends.length > 0 ? (
          <View style={styles.section}>
            {(filteredPendingRequests.length > 0 || filteredSentRequests.length > 0) ? (
              <ThemedText style={[Typography.h2, { color: theme.text, marginBottom: Spacing.md }]}>
                Your Friends ({filteredFriends.length})
              </ThemedText>
            ) : null}
            {filteredFriends.map((item) => {
              const details = item.friend_details;
              if (!details) return null;
              
              return (
                <Pressable 
                  key={item.id} 
                  onPress={() => handleFriendPress(details)}
                  style={({ pressed }) => [
                    styles.friendCard, 
                    { borderBottomColor: theme.border, opacity: pressed ? 0.7 : 1 }
                  ]}
                >
                  <View style={[styles.avatar, { backgroundColor: theme.backgroundSecondary }]}>
                    {details.profile_picture ? (
                      <Image source={{ uri: details.profile_picture }} style={styles.avatarImage} />
                    ) : (
                      <Feather name="user" size={24} color={theme.textSecondary} />
                    )}
                  </View>
                  <View style={styles.friendInfo}>
                    <View style={styles.friendNameRow}>
                      <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
                        {details.name}
                      </ThemedText>
                      {item.gamification?.current_level ? (
                        <LevelBadge level={item.gamification.current_level} size="small" showTitle />
                      ) : null}
                    </View>
                    <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                      ID: {details.unique_id}
                    </ThemedText>
                  </View>
                  <Feather name="chevron-right" size={20} color={theme.textSecondary} />
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {blockedUsers.length > 0 ? (
          <View style={styles.section}>
            <ThemedText style={[Typography.h2, { color: theme.text, marginBottom: Spacing.md }]}>
              Blocked Users ({blockedUsers.length})
            </ThemedText>
            {blockedUsers.map((blockedUser) => {
              const details = blockedUser.blocked_user;
              if (!details) return null;
              
              return (
                <View 
                  key={blockedUser.id} 
                  style={[styles.requestCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <View style={[styles.avatar, { backgroundColor: theme.backgroundSecondary }]}>
                    {details.profile_picture ? (
                      <Image source={{ uri: details.profile_picture }} style={styles.avatarImage} />
                    ) : (
                      <Feather name="user" size={24} color={theme.textSecondary} />
                    )}
                  </View>
                  <View style={styles.friendInfo}>
                    <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
                      {details.name}
                    </ThemedText>
                    <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                      ID: {details.unique_id}
                    </ThemedText>
                  </View>
                  <Pressable
                    style={({ pressed }) => [
                      styles.unblockBtn,
                      { borderColor: theme.primary, opacity: pressed ? 0.7 : 1 }
                    ]}
                    onPress={() => handleUnblock(blockedUser.blocked_user_id, details.name)}
                  >
                    <ThemedText style={[Typography.caption, { color: theme.primary, fontWeight: '600' }]}>
                      Unblock
                    </ThemedText>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}

        {filteredFriends.length === 0 && filteredPendingRequests.length === 0 && filteredSentRequests.length === 0 && blockedUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="users" size={48} color={theme.textSecondary} />
            <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.lg, textAlign: 'center' }]}>
              {searchQuery ? 'No friends found' : 'Add friends using their unique ID'}
            </ThemedText>
            {!searchQuery ? (
              <Pressable
                style={({ pressed }) => [
                  styles.emptyButton,
                  { backgroundColor: theme.primary, opacity: pressed ? 0.7 : 1 }
                ]}
                onPress={() => navigation.navigate('AddFriend')}
              >
                <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                  Add Friend
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <FriendProfileModal
        visible={profileModalVisible}
        onClose={() => {
          setProfileModalVisible(false);
          setSelectedFriend(null);
        }}
        friend={selectedFriend}
        userId={user?.id}
        onBlock={() => {
          setProfileModalVisible(false);
          setSelectedFriend(null);
          loadData();
        }}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.md,
    fontSize: 16,
  },
  referralCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    padding: Spacing.md,
  },
  referralHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  helpIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  referralInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  referralInput: {
    flex: 1,
    height: 42,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 14,
  },
  referralButton: {
    height: 42,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
  },
  avatar: {
    width: Spacing.avatarMedium,
    height: Spacing.avatarMedium,
    borderRadius: Spacing.avatarMedium / 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  friendInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  friendNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'] * 2,
  },
  emptyButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
    marginTop: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  requestActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  declineBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  sentRequestActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  unblockBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
});
