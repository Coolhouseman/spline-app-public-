import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Pressable, FlatList, RefreshControl } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { storageService, SplitEvent } from '@/utils/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeBottomTabBarHeight } from '@/hooks/useSafeBottomTabBarHeight';

type Props = NativeStackScreenProps<any, 'MainHome'>;

export default function MainHomeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useSafeBottomTabBarHeight();
  const [selectedTab, setSelectedTab] = useState<'in_progress' | 'completed'>('in_progress');
  const [events, setEvents] = useState<SplitEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<number>(0);

  const loadData = useCallback(async () => {
    const allEvents = await storageService.getEvents();
    setEvents(allEvents);
    const notifs = await storageService.getNotifications();
    setNotifications(notifs.length);
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const filteredEvents = events.filter(e => 
    selectedTab === 'in_progress' ? e.status === 'in_progress' : e.status === 'completed'
  );

  const getProgress = (event: SplitEvent) => {
    const paid = event.participants.filter(p => p.status === 'paid').length;
    const total = event.participants.length;
    return total > 0 ? (paid / total) * 100 : 0;
  };

  const renderEvent = ({ item }: { item: SplitEvent }) => {
    const progress = getProgress(item);
    const isInitiator = item.initiatorId === user?.id;

    return (
      <Pressable
        style={({ pressed }) => [
          styles.eventCard,
          { 
            backgroundColor: theme.surface,
            borderColor: theme.border,
            opacity: pressed ? 0.7 : 1
          }
        ]}
        onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
      >
        <View style={styles.eventHeader}>
          <ThemedText style={[Typography.h2, { color: theme.text, flex: 1 }]}>
            {item.name}
          </ThemedText>
          {isInitiator ? (
            <View style={[styles.badge, { backgroundColor: theme.primary }]}>
              <ThemedText style={[Typography.small, { color: '#FFFFFF' }]}>You</ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.eventInfo}>
          <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
            ${item.totalAmount.toFixed(2)}
          </ThemedText>
          <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
            Your share: ${item.myShare.toFixed(2)}
          </ThemedText>
        </View>

        {item.status === 'in_progress' ? (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
              <View 
                style={[
                  styles.progressFill, 
                  { backgroundColor: theme.primary, width: `${progress}%` }
                ]} 
              />
            </View>
            <ThemedText style={[Typography.small, { color: theme.textSecondary, marginTop: Spacing.xs }]}>
              {Math.round(progress)}% paid
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.eventFooter}>
          <View style={styles.participantCount}>
            <Feather name="users" size={14} color={theme.textSecondary} />
            <ThemedText style={[Typography.small, { color: theme.textSecondary, marginLeft: Spacing.xs }]}>
              {item.participants.length} participants
            </ThemedText>
          </View>
          <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
            {new Date(item.createdAt).toLocaleDateString()}
          </ThemedText>
        </View>
      </Pressable>
    );
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.xl }]}>
      <View style={styles.header}>
        <ThemedText style={[Typography.h1, { color: theme.text }]}>Split</ThemedText>
        <Pressable
          style={({ pressed }) => [styles.notificationButton, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Feather name="bell" size={24} color={theme.text} />
          {notifications > 0 ? (
            <View style={[styles.badge, { backgroundColor: theme.danger, position: 'absolute', top: -4, right: -4 }]}>
              <ThemedText style={[Typography.small, { color: '#FFFFFF' }]}>
                {notifications}
              </ThemedText>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={[styles.segmentedControl, { backgroundColor: theme.backgroundSecondary }]}>
        <Pressable
          style={[
            styles.segment,
            selectedTab === 'in_progress' && { backgroundColor: theme.surface }
          ]}
          onPress={() => setSelectedTab('in_progress')}
        >
          <ThemedText 
            style={[
              Typography.body,
              { color: selectedTab === 'in_progress' ? theme.text : theme.textSecondary }
            ]}
          >
            In Progress
          </ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.segment,
            selectedTab === 'completed' && { backgroundColor: theme.surface }
          ]}
          onPress={() => setSelectedTab('completed')}
        >
          <ThemedText 
            style={[
              Typography.body,
              { color: selectedTab === 'completed' ? theme.text : theme.textSecondary }
            ]}
          >
            Completed
          </ThemedText>
        </Pressable>
      </View>

      <FlatList
        data={filteredEvents}
        renderItem={renderEvent}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBarHeight + Spacing.xl + Spacing.fabSize }
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="inbox" size={48} color={theme.textSecondary} />
            <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.lg }]}>
              {selectedTab === 'in_progress' ? 'No active splits' : 'No completed splits'}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  notificationButton: {
    padding: Spacing.sm,
  },
  segmentedControl: {
    flexDirection: 'row',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    padding: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs - 2,
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
  },
  eventCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  eventInfo: {
    marginBottom: Spacing.md,
  },
  progressContainer: {
    marginBottom: Spacing.md,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  eventFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  participantCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'] * 2,
  },
});
