import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, FlatList, Image, TextInput, RefreshControl, Alert, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { FriendsService } from '@/services/friends.service';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeBottomTabBarHeight } from '@/hooks/useSafeBottomTabBarHeight';

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
}

interface SentRequest {
  id: string;
  user_id: string;
  friend_id: string;
  status: string;
  recipient: {
    id: string;
    unique_id: string;
    name: string;
    email: string;
    profile_picture?: string;
    bio?: string;
  };
}

export default function FriendsScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useSafeBottomTabBarHeight();
  const [friends, setFriends] = useState<FriendWithDetails[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<SentRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [navigation, user?.id]);

  const loadData = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      const [friendsData, requestsData, sentData] = await Promise.all([
        FriendsService.getFriends(user.id),
        FriendsService.getPendingRequests(user.id),
        FriendsService.getSentPendingRequests(user.id),
      ]);
      setFriends(friendsData as FriendWithDetails[]);
      setPendingRequests(requestsData as unknown as PendingRequest[]);
      setSentRequests(sentData as unknown as SentRequest[]);
    } catch (error) {
      console.error('Failed to load friends:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const filteredFriends = friends.filter(f => {
    const name = f.friend_details?.name || '';
    const uniqueId = f.friend_details?.unique_id || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      uniqueId.includes(searchQuery);
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
          <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
            {details.name}
          </ThemedText>
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
        <View style={[styles.pendingBadge, { backgroundColor: theme.primary + '20' }]}>
          <ThemedText style={[Typography.caption, { color: theme.primary, fontWeight: '600' }]}>
            Pending
          </ThemedText>
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

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBarHeight + Spacing.xl + Spacing.fabSize }
        ]}
      >
        {pendingRequests.length > 0 ? (
          <View style={styles.section}>
            <ThemedText style={[Typography.h2, { color: theme.text, marginBottom: Spacing.md }]}>
              Friend Requests ({pendingRequests.length})
            </ThemedText>
            {pendingRequests.map(renderPendingRequest)}
          </View>
        ) : null}

        {sentRequests.length > 0 ? (
          <View style={styles.section}>
            <ThemedText style={[Typography.h2, { color: theme.text, marginBottom: Spacing.md }]}>
              Sent Requests ({sentRequests.length})
            </ThemedText>
            {sentRequests.map(renderSentRequest)}
          </View>
        ) : null}

        {filteredFriends.length > 0 ? (
          <View style={styles.section}>
            {(pendingRequests.length > 0 || sentRequests.length > 0) ? (
              <ThemedText style={[Typography.h2, { color: theme.text, marginBottom: Spacing.md }]}>
                Your Friends ({filteredFriends.length})
              </ThemedText>
            ) : null}
            {filteredFriends.map((item) => {
              const details = item.friend_details;
              if (!details) return null;
              
              return (
                <View key={item.id} style={[styles.friendCard, { borderBottomColor: theme.border }]}>
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
                </View>
              );
            })}
          </View>
        ) : null}

        {filteredFriends.length === 0 && pendingRequests.length === 0 && sentRequests.length === 0 ? (
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
});
