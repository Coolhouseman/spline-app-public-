import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, FlatList, Image } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { storageService, Friend } from '@/utils/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<any, 'CreateSplitSelectFriends'>;

export default function CreateSplitSelectFriendsScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    const allFriends = await storageService.getFriends();
    setFriends(allFriends);
  };

  const toggleSelection = (uniqueId: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(uniqueId)) {
      newSelected.delete(uniqueId);
    } else {
      newSelected.add(uniqueId);
    }
    setSelected(newSelected);
  };

  const handleContinue = () => {
    const selectedFriends = friends.filter(f => selected.has(f.uniqueId));
    navigation.navigate('CreateSplitType', { selectedFriends });
  };

  const renderFriend = ({ item }: { item: Friend }) => {
    const isSelected = selected.has(item.uniqueId);

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
        onPress={() => toggleSelection(item.uniqueId)}
      >
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

      <FlatList
        data={friends}
        renderItem={renderFriend}
        keyExtractor={(item) => item.uniqueId}
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
