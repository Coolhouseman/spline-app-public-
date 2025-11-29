import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, StyleSheet, Pressable, FlatList, RefreshControl, ActivityIndicator, AppState, AppStateStatus, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { Gesture, GestureDetector, GestureType } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS, useDerivedValue, withTiming, SharedValue } from 'react-native-reanimated';
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

const DELETE_BUTTON_WIDTH = 80;
const SWIPE_THRESHOLD = DELETE_BUTTON_WIDTH * 0.5;

function SwipeableEventCard({ 
  item, 
  onPress, 
  onDelete,
  showGreyOverlay,
  isCreator,
  userAmount,
  theme,
  swipeOpenIdShared,
  setSwipeOpenId,
  nativeScrollGesture
}: {
  item: SplitEvent;
  onPress: () => void;
  onDelete: () => void;
  showGreyOverlay: boolean;
  isCreator: boolean;
  userAmount: number;
  theme: any;
  swipeOpenIdShared: SharedValue<string | null>;
  setSwipeOpenId: (id: string | null) => void;
  nativeScrollGesture: GestureType;
}) {
  const translateX = useSharedValue(0);
  const isOpen = useSharedValue(false);
  const itemIdRef = useRef(item.id);

  useDerivedValue(() => {
    const isThisOpen = swipeOpenIdShared.value === item.id;
    if (!isThisOpen && translateX.value !== 0) {
      translateX.value = withTiming(0, { duration: 200 });
      isOpen.value = false;
    }
  }, [item.id]);

  if (itemIdRef.current !== item.id) {
    translateX.value = 0;
    isOpen.value = false;
    itemIdRef.current = item.id;
  }

  const closeSwipe = useCallback(() => {
    setSwipeOpenId(null);
  }, [setSwipeOpenId]);

  const openSwipe = useCallback(() => {
    setSwipeOpenId(item.id);
  }, [setSwipeOpenId, item.id]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Remove Split',
      'Remove this split from your view? This won\'t affect other participants.',
      [
        { 
          text: 'Cancel', 
          style: 'cancel', 
          onPress: () => {
            translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
            closeSwipe();
          }
        },
        { 
          text: 'Remove', 
          style: 'destructive', 
          onPress: () => {
            translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
            closeSwipe();
            onDelete();
          }
        },
      ]
    );
  }, [translateX, closeSwipe, onDelete]);

  const panGesture = useMemo(() => 
    Gesture.Pan()
      .activeOffsetX([-25, 25])
      .failOffsetY([-20, 20])
      .maxPointers(1)
      .simultaneousWithExternalGesture(nativeScrollGesture)
      .onStart(() => {
        'worklet';
      })
      .onUpdate((event) => {
        'worklet';
        const base = isOpen.value ? -DELETE_BUTTON_WIDTH : 0;
        const newValue = base + event.translationX;
        translateX.value = Math.max(Math.min(newValue, 0), -DELETE_BUTTON_WIDTH);
      })
      .onEnd(() => {
        'worklet';
        if (translateX.value < -SWIPE_THRESHOLD) {
          translateX.value = withSpring(-DELETE_BUTTON_WIDTH, { damping: 20, stiffness: 200 });
          isOpen.value = true;
          runOnJS(openSwipe)();
        } else {
          translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
          isOpen.value = false;
          runOnJS(closeSwipe)();
        }
      }),
    [translateX, isOpen, openSwipe, closeSwipe, nativeScrollGesture]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.swipeableContainer}>
      <Pressable 
        style={[styles.deleteButtonContainer, { backgroundColor: theme.danger }]}
        onPress={handleDelete}
      >
        <View style={styles.deleteButton}>
          <Feather name="trash-2" size={24} color="#FFFFFF" />
        </View>
      </Pressable>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.eventCard, animatedStyle]}>
          <Pressable
            style={({ pressed }) => [
              styles.eventCardInner,
              { 
                backgroundColor: theme.surface,
                borderColor: theme.border,
                opacity: pressed ? 0.7 : 1
              }
            ]}
            onPress={onPress}
          >
            {showGreyOverlay ? (
              <View style={styles.paidOverlay}>
                <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.text, opacity: 0.08 }]} />
              </View>
            ) : null}
            
            <View style={styles.eventHeader}>
              <ThemedText style={[Typography.h2, { color: showGreyOverlay ? theme.textSecondary : theme.text, flex: 1 }]}>
                {item.name}
              </ThemedText>
              <View style={styles.badgeContainer}>
                {isCreator ? (
                  <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                    <ThemedText style={[Typography.small, { color: '#FFFFFF' }]}>Creator</ThemedText>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.eventInfo}>
              <ThemedText style={[Typography.body, { color: showGreyOverlay ? theme.textSecondary : theme.text, fontWeight: '600' }]}>
                ${parseFloat(item.total_amount?.toString() || '0').toFixed(2)}
              </ThemedText>
              <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                Your share: ${parseFloat(userAmount.toString()).toFixed(2)}
              </ThemedText>
            </View>

            <View style={styles.eventFooter}>
              <View style={styles.participantCount}>
                <Feather name="users" size={14} color={theme.textSecondary} />
                <ThemedText style={[Typography.small, { color: theme.textSecondary, marginLeft: Spacing.xs }]}>
                  {item.participants?.length || 0} participants
                </ThemedText>
              </View>
              <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                {new Date(item.created_at).toLocaleDateString()}
              </ThemedText>
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function EventCard({ 
  item, 
  onPress, 
  showGreyOverlay,
  isCreator,
  userAmount,
  progress,
  theme 
}: {
  item: SplitEvent;
  onPress: () => void;
  showGreyOverlay: boolean;
  isCreator: boolean;
  userAmount: number;
  progress: number;
  theme: any;
}) {
  return (
    <View style={styles.eventCard}>
      <Pressable
        style={({ pressed }) => [
          styles.eventCardInner,
          { 
            backgroundColor: theme.surface,
            borderColor: theme.border,
            opacity: pressed ? 0.7 : 1
          }
        ]}
        onPress={onPress}
      >
        {showGreyOverlay ? (
          <View style={styles.paidOverlay}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.text, opacity: 0.08 }]} />
          </View>
        ) : null}
        
        <View style={styles.eventHeader}>
          <ThemedText style={[Typography.h2, { color: showGreyOverlay ? theme.textSecondary : theme.text, flex: 1 }]}>
            {item.name}
          </ThemedText>
          <View style={styles.badgeContainer}>
            {isCreator ? (
              <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                <ThemedText style={[Typography.small, { color: '#FFFFFF' }]}>Creator</ThemedText>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.eventInfo}>
          <ThemedText style={[Typography.body, { color: showGreyOverlay ? theme.textSecondary : theme.text, fontWeight: '600' }]}>
            ${parseFloat(item.total_amount?.toString() || '0').toFixed(2)}
          </ThemedText>
          <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
            Your share: ${parseFloat(userAmount.toString()).toFixed(2)}
          </ThemedText>
        </View>

        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: showGreyOverlay ? theme.textSecondary + '30' : theme.border }]}>
            <View 
              style={[
                styles.progressFill, 
                { backgroundColor: showGreyOverlay ? theme.textSecondary : theme.primary, width: `${progress}%` }
              ]} 
            />
          </View>
          <View style={styles.progressInfo}>
            <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
              {Math.round(progress)}% paid
            </ThemedText>
          </View>
        </View>

        <View style={styles.eventFooter}>
          <View style={styles.participantCount}>
            <Feather name="users" size={14} color={theme.textSecondary} />
            <ThemedText style={[Typography.small, { color: theme.textSecondary, marginLeft: Spacing.xs }]}>
              {item.participants?.length || 0} participants
            </ThemedText>
          </View>
          <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
            {new Date(item.created_at).toLocaleDateString()}
          </ThemedText>
        </View>
      </Pressable>
    </View>
  );
}

export default function MainHomeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useSafeBottomTabBarHeight();
  const scrollRef = useRef<FlatList>(null);
  const [selectedTab, setSelectedTab] = useState<'in_progress' | 'completed'>('in_progress');
  const [events, setEvents] = useState<SplitEvent[]>([]);
  const [hiddenEventIds, setHiddenEventIds] = useState<string[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<number>(0);
  const [networkError, setNetworkError] = useState(false);
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  const swipeOpenIdShared = useSharedValue<string | null>(null);
  const retryCountRef = useRef(0);
  const appState = useRef(AppState.currentState);

  const nativeScrollGesture = useMemo(() => Gesture.Native(), []);

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

  const updateSwipeOpenId = useCallback((id: string | null) => {
    setSwipeOpenId(id);
    swipeOpenIdShared.value = id;
  }, [swipeOpenIdShared]);

  useEffect(() => {
    updateSwipeOpenId(null);
  }, [selectedTab, updateSwipeOpenId]);

  const onRefresh = async () => {
    setRefreshing(true);
    updateSwipeOpenId(null);
    retryCountRef.current = 0;
    await loadData();
    setRefreshing(false);
  };

  const handleHideEvent = (eventId: string) => {
    setHiddenEventIds(prev => [...prev, eventId]);
  };

  const filteredEvents = events.filter(event => {
    if (!user || !event.participants) return false;
    
    if (hiddenEventIds.includes(event.id)) return false;
    
    const userParticipant = event.participants.find((p: any) => p.user_id === user.id);
    if (!userParticipant) return false;
    
    const isCreator = event.creator_id === user.id;
    const userAccepted = userParticipant.status === 'accepted' || userParticipant.status === 'paid';
    
    if (!isCreator && !userAccepted) return false;
    
    const allSettled = event.participants.every((p: any) => p.status === 'paid' || p.is_creator);
    return selectedTab === 'in_progress' ? !allSettled : allSettled;
  });

  const getProgress = (event: any) => {
    const paid = event.participants.filter((p: any) => p.status === 'paid').length;
    const total = event.participants.length;
    return total > 0 ? (paid / total) * 100 : 0;
  };

  const renderEvent = ({ item }: { item: SplitEvent }) => {
    const progress = getProgress(item);
    const isCreator = item.creator_id === user?.id;
    const userParticipant = item.participants?.find((p: any) => p.user_id === user?.id);
    const userAmount = userParticipant?.amount || 0;
    const userHasPaid = userParticipant?.status === 'paid';
    const isCompleted = selectedTab === 'completed';
    
    // Grey overlay only shows when: user is NOT the creator AND user has paid AND split is still in progress
    const showGreyOverlay = selectedTab === 'in_progress' && !isCreator && userHasPaid && progress < 100;

    if (isCompleted) {
      return (
        <SwipeableEventCard
          key={item.id}
          item={item}
          onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
          onDelete={() => handleHideEvent(item.id)}
          showGreyOverlay={false}
          isCreator={isCreator}
          userAmount={userAmount}
          theme={theme}
          swipeOpenIdShared={swipeOpenIdShared}
          setSwipeOpenId={updateSwipeOpenId}
          nativeScrollGesture={nativeScrollGesture}
        />
      );
    }

    return (
      <EventCard
        item={item}
        onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
        showGreyOverlay={showGreyOverlay}
        isCreator={isCreator}
        userAmount={userAmount}
        progress={progress}
        theme={theme}
      />
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

      <GestureDetector gesture={nativeScrollGesture}>
        <FlatList
          ref={scrollRef}
          data={filteredEvents}
          renderItem={renderEvent}
          keyExtractor={(item) => item.id}
          extraData={swipeOpenId}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: tabBarHeight + Spacing.xl + Spacing.fabSize }
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
          }
          onScrollBeginDrag={() => updateSwipeOpenId(null)}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="inbox" size={48} color={theme.textSecondary} />
              <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.lg }]}>
                {selectedTab === 'in_progress' ? 'No active splits' : 'No completed splits'}
              </ThemedText>
            </View>
          }
        />
      </GestureDetector>
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
  swipeableContainer: {
    marginBottom: Spacing.lg,
    position: 'relative',
  },
  deleteButtonContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DELETE_BUTTON_WIDTH,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventCard: {
    marginBottom: Spacing.lg,
  },
  eventCardInner: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  paidOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'] * 2,
  },
});
