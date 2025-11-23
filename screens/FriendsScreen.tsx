import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, FlatList, Image, TextInput } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { storageService, Friend } from '@/utils/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeBottomTabBarHeight } from '@/hooks/useSafeBottomTabBarHeight';

type Props = NativeStackScreenProps<any, 'Friends'>;

export default function FriendsScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useSafeBottomTabBarHeight();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadFriends();
    const unsubscribe = navigation.addListener('focus', loadFriends);
    return unsubscribe;
  }, [navigation]);

  const loadFriends = async () => {
    const allFriends = await storageService.getFriends();
    setFriends(allFriends);
  };

  const filteredFriends = friends.filter(f =>
    `${f.firstName} ${f.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.uniqueId.includes(searchQuery)
  );

  const renderFriend = ({ item }: { item: Friend }) => (
    <View style={[styles.friendCard, { borderBottomColor: theme.border }]}>
      <View style={[styles.avatar, { backgroundColor: theme.backgroundSecondary }]}>
        {item.profilePicture ? (
          <Image source={{ uri: item.profilePicture }} style={styles.avatarImage} />
        ) : (
          <Feather name="user" size={24} color={theme.textSecondary} />
        )}
      </View>
      <View style={styles.friendInfo}>
        <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
          {item.firstName} {item.lastName}
        </ThemedText>
        <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
          ID: {item.uniqueId}
        </ThemedText>
      </View>
    </View>
  );

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

      <FlatList
        data={filteredFriends}
        renderItem={renderFriend}
        keyExtractor={(item) => item.uniqueId}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBarHeight + Spacing.xl + Spacing.fabSize }
        ]}
        ListEmptyComponent={
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
        }
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
});
