import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, Pressable, FlatList, RefreshControl, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { SplitEvent, Wallet } from '@/shared/types';
import { SplitsService } from '@/services/splits.service';
import { WalletService } from '@/services/wallet.service';
import { NotificationsService } from '@/services/notifications.service';
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
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<number>(0);
  const [networkError, setNetworkError] = useState(false);
  const retryCountRef = useRef(0);
  const appState = useRef(AppState.currentState);

  const loadData = useCallback(async (isRetry = false) => {
    if (!user) return;
    
    try {
      const [splitsData, walletData, unreadCount] = await Promise.all([
        SplitsService.getSplits(user.id),
        WalletService.getWallet(user.id),
        NotificationsService.getUnreadCount(user.id),
      ]);
      
      setEvents(splitsData);
      setWallet(walletData);
      setNotifications(unreadCount);
      setNetworkError(false);
      retryCountRef.current = 0;
    } catch (error: any) {
      const isNetworkError = error?.message?.includes('Network') || 
                             error?.message?.includes('network') ||
                             error?.message?.includes('fetch');
      
      if (isNetworkError) {
        setNetworkError(true);
        if (!isRetry && retryCountRef.current < 3) {
          retryCountRef.current += 1;
          const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), 5000);
          setTimeout(() => loadData(true), delay);
        }
      } else {
        console.error('Failed to load home data:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(false), 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        retryCountRef.current = 0;
        loadData();
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    retryCountRef.current = 0;
    await loadData();
    setRefreshing(false);
  };

  const filteredEvents = events.filter(event => {
    if (!user || !event.participants) return false;
    
    const userParticipant = event.participants.find((p: any) => p.user_id === user.id);
    if (!userParticipant) return false;
    
    const isCreator = event.creator_id === user.id;
    
    if (isCreator) {
      const allSettled = event.participants.every((p: any) => p.status === 'paid' || p.is_creator);
      return selectedTab === 'in_progress' ? !allSettled : allSettled;
    } else {
      const userAccepted = userParticipant.status === 'accepted' || userParticipant.status === 'paid';
      if (!userAccepted) return false;
      
      const isPaid = userParticipant.status === 'paid';
      return selectedTab === 'in_progress' ? !isPaid : isPaid;
    }
  });

  const getProgress = (event: any) => {
    const paid = event.participants.filter((p: any) => p.status === 'paid').length;
    const total = event.participants.length;
    return total > 0 ? (paid / total) * 100 : 0;
  };

  const renderEvent = ({ item }: { item: any }) => {
    const progress = getProgress(item);
    const isCreator = item.creator_id === user?.id;
    const userParticipant = item.participants.find((p: any) => p.user_id === user?.id);
    const userAmount = userParticipant?.amount || 0;

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
          {isCreator ? (
            <View style={[styles.badge, { backgroundColor: theme.primary }]}>
              <ThemedText style={[Typography.small, { color: '#FFFFFF' }]}>Creator</ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.eventInfo}>
          <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
            ${parseFloat(item.total_amount).toFixed(2)}
          </ThemedText>
          <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
            Your share: ${parseFloat(userAmount).toFixed(2)}
          </ThemedText>
        </View>

        {selectedTab === 'in_progress' ? (
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
            {new Date(item.created_at).toLocaleDateString()}
          </ThemedText>
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.xl }]}>
      {networkError && !loading ? (
        <Pressable 
          style={[styles.networkBanner, { backgroundColor: theme.warning + '20' }]}
          onPress={onRefresh}
        >
          <Feather name="wifi-off" size={14} color={theme.warning} />
          <ThemedText style={[Typography.small, { color: theme.warning, marginLeft: Spacing.sm, flex: 1 }]}>
            Connection issue. Tap to retry
          </ThemedText>
          <ActivityIndicator size="small" color={theme.warning} />
        </Pressable>
      ) : null}

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

      {wallet ? (
        <ThemedView style={[styles.walletCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.walletHeader}>
            <View style={[styles.walletIconContainer, { backgroundColor: theme.primary + '20' }]}>
              <Feather name="dollar-sign" size={24} color={theme.primary} />
            </View>
            <View style={styles.walletInfo}>
              <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                Wallet Balance
              </ThemedText>
              <ThemedText style={[Typography.h1, { color: theme.text }]}>
                ${parseFloat(wallet.balance.toString()).toFixed(2)}
              </ThemedText>
            </View>
          </View>
        </ThemedView>
      ) : null}

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
  networkBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.xs,
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
  walletCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  walletHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  walletIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  walletInfo: {
    flex: 1,
  },
  walletActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  walletButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xs,
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
