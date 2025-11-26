import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, FlatList, Image, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { FriendsService } from '@/services/friends.service';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<any, 'CreateSplitSelectFriends'>;

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
  };
}

export default function CreateSplitSelectFriendsScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const params = route.params as { splitType?: 'equal' | 'specified' } | undefined;
  const splitType = params?.splitType;
  const [friends, setFriends] = useState<FriendWithDetails[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    if (!splitType) {
      navigation.goBack();
    }
  }, [splitType, navigation]);

  useEffect(() => {
    loadFriends();
  }, [user?.id]);

  const loadFriends = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const data = await FriendsService.getFriends(user.id);
      setFriends(data as FriendWithDetails[]);
    } catch (error) {
      console.error('Failed to load friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (friendId: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(friendId)) {
      newSelected.delete(friendId);
    } else {
      newSelected.add(friendId);
    }
    setSelected(newSelected);
  };

  const handleContinue = () => {
    if (!splitType) return;
    const selectedFriends = friends
      .filter(f => selected.has(f.friend_id))
      .map(f => ({
        uniqueId: f.friend_details.unique_id,
        odooUserId: f.friend_id,
        firstName: f.friend_details.name.split(' ')[0] || f.friend_details.name,
        lastName: f.friend_details.name.split(' ').slice(1).join(' ') || '',
        profilePicture: f.friend_details.profile_picture,
      }));
    navigation.navigate('CreateSplitDetails', { selectedFriends, splitType });
  };

  const renderFriend = ({ item }: { item: FriendWithDetails }) => {
    const details = item.friend_details;
    if (!details) return null;
    
    const isSelected = selected.has(item.friend_id);

    return (
      <Pressable
        style={({ pressed }) => [
          styles.friendCard,
          { 
            backgroundColor: theme.surface,
            borderColor: isSelected ? theme.primary : theme.border,
            borderWidth: isSelected ? 2 : 1,
            opacity: pressed ? 0.7 : 1
          }
        ]}
        onPress={() => toggleSelection(item.friend_id)}
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
        {isSelected ? (
          <Feather name="check-circle" size={24} color={theme.primary} />
        ) : (
          <View style={[styles.checkbox, { borderColor: theme.border }]} />
        )}
      </Pressable>
    );
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.xl }]}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText style={[Typography.h1, { color: theme.text, flex: 1, textAlign: 'center' }]}>
          Select Friends
        </ThemedText>
        <Pressable
          style={({ pressed }) => [
            styles.continueButton,
            { opacity: pressed ? 0.7 : (selected.size === 0 ? 0.4 : 1) }
          ]}
          onPress={handleContinue}
          disabled={selected.size === 0}
        >
          <ThemedText style={[Typography.body, { color: selected.size > 0 ? theme.primary : theme.textSecondary }]}>
            Next
          </ThemedText>
        </Pressable>
      </View>

      {selected.size > 0 ? (
        <View style={[styles.selectedBanner, { backgroundColor: theme.primary + '20' }]}>
          <ThemedText style={[Typography.body, { color: theme.primary }]}>
            {selected.size} friend{selected.size > 1 ? 's' : ''} selected
          </ThemedText>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={friends}
          renderItem={renderFriend}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="users" size={48} color={theme.textSecondary} />
              <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.lg }]}>
                No friends yet. Add friends first.
              </ThemedText>
            </View>
          }
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  continueButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  selectedBanner: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
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
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'] * 2,
  },
});
