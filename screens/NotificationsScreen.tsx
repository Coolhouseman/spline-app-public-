import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Pressable, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { NotificationsService } from '@/services/notifications.service';
import { SplitsService } from '@/services/splits.service';
import { FriendsService } from '@/services/friends.service';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/services/supabase';
import type { Notification } from '@/shared/types';

type Props = NativeStackScreenProps<any, 'Notifications'>;

interface FriendshipStatus {
  [key: string]: 'pending' | 'accepted' | 'declined' | 'unknown';
}

export default function NotificationsScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [friendshipStatuses, setFriendshipStatuses] = useState<FriendshipStatus>({});

  const loadFriendshipStatuses = useCallback(async (notifs: Notification[]) => {
    const friendRequestNotifs = notifs.filter(n => n.type === 'friend_request');
    const friendshipIds = friendRequestNotifs
      .map(n => n.friendship_id || (n.metadata as any)?.friendship_id)
      .filter(Boolean);
    
    if (friendshipIds.length === 0) return;

    const { data } = await supabase
      .from('friends')
      .select('id, status')
      .in('id', friendshipIds);

    if (data) {
      const statuses: FriendshipStatus = {};
      data.forEach(f => {
        statuses[f.id] = f.status as 'pending' | 'accepted' | 'declined';
      });
      setFriendshipStatuses(statuses);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const notifs = await NotificationsService.getNotifications(user.id);
      setNotifications(notifs);
      await loadFriendshipStatuses(notifs);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user, loadFriendshipStatuses]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const navigateToRelevantScreen = (notification: Notification) => {
    switch (notification.type) {
      case 'friend_request':
      case 'friend_accepted':
        navigation.navigate('MainTabs', { screen: 'FriendsTab' });
        break;
      case 'split_invite':
      case 'split_accepted':
      case 'split_declined':
      case 'split_paid':
      case 'split_completed':
        if (notification.split_event_id) {
          navigation.navigate('MainTabs', { 
            screen: 'HomeTab', 
            params: { 
              screen: 'EventDetail', 
              params: { eventId: notification.split_event_id } 
            } 
          });
        } else {
          navigation.navigate('MainTabs', { screen: 'HomeTab' });
        }
        break;
      case 'payment_reminder':
        navigation.navigate('MainTabs', { screen: 'HomeTab' });
        break;
      default:
        break;
    }
  };

  const handleNotificationTap = async (notification: Notification) => {
    if (processingId) return;
    
    setProcessingId(notification.id);
    try {
      if (!notification.read) {
        await NotificationsService.markAsRead(notification.id);
        setNotifications(prev => 
          prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
        );
      }
      navigateToRelevantScreen(notification);
    } catch (error) {
      console.error('Failed to handle notification tap:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleAccept = async (notification: Notification) => {
    if (!user || !notification.split_event_id) return;
    
    setProcessingId(notification.id);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await SplitsService.respondToSplit(user.id, notification.split_event_id, 'accepted');
      await NotificationsService.markAsRead(notification.id);
      await loadNotifications();
    } catch (error) {
      console.error('Failed to accept split:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (notification: Notification) => {
    if (!user || !notification.split_event_id) return;
    
    setProcessingId(notification.id);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await SplitsService.respondToSplit(user.id, notification.split_event_id, 'declined');
      await NotificationsService.markAsRead(notification.id);
      await loadNotifications();
    } catch (error) {
      console.error('Failed to decline split:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleAcceptFriendRequest = async (notification: Notification) => {
    console.log('handleAcceptFriendRequest - notification:', JSON.stringify(notification, null, 2));
    console.log('handleAcceptFriendRequest - friendship_id:', notification.friendship_id);
    console.log('handleAcceptFriendRequest - metadata:', notification.metadata);
    
    if (!user || !notification.friendship_id) {
      console.error('Missing user or friendship_id. user:', user?.id, 'friendship_id:', notification.friendship_id);
      return;
    }
    
    setProcessingId(notification.id);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      console.log('Calling FriendsService.acceptFriendRequest with userId:', user.id, 'friendshipId:', notification.friendship_id);
      await FriendsService.acceptFriendRequest(user.id, notification.friendship_id);
      await NotificationsService.markAsRead(notification.id);
      await loadNotifications();
    } catch (error) {
      console.error('Failed to accept friend request:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeclineFriendRequest = async (notification: Notification) => {
    if (!user || !notification.friendship_id) return;
    
    setProcessingId(notification.id);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await FriendsService.declineFriendRequest(user.id, notification.friendship_id);
      await NotificationsService.markAsRead(notification.id);
      await loadNotifications();
    } catch (error) {
      console.error('Failed to decline friend request:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'split_invite':
        return 'users';
      case 'split_accepted':
        return 'check-circle';
      case 'split_declined':
        return 'x-circle';
      case 'split_paid':
        return 'dollar-sign';
      case 'split_completed':
        return 'check-circle';
      case 'friend_request':
        return 'user-plus';
      case 'friend_accepted':
        return 'user-check';
      case 'payment_reminder':
        return 'clock';
      default:
        return 'bell';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'split_accepted':
      case 'split_paid':
      case 'split_completed':
      case 'friend_accepted':
        return theme.success;
      case 'split_declined':
        return theme.danger;
      case 'friend_request':
        return theme.primary;
      case 'payment_reminder':
        return theme.warning;
      default:
        return theme.primary;
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const isProcessing = processingId === item.id;
    const showSplitActions = item.type === 'split_invite' && !item.read;
    const friendshipId = item.friendship_id || (item.metadata as any)?.friendship_id;
    const friendshipStatus = friendshipId ? friendshipStatuses[friendshipId] : undefined;
    const isStillPending = friendshipStatus === 'pending' || friendshipStatus === undefined;
    const showFriendActions = item.type === 'friend_request' && !item.read && friendshipId && isStillPending;
    const friendRequestHandled = item.type === 'friend_request' && friendshipId && !isStillPending;
    const iconColor = getNotificationColor(item.type);
    const hasActions = showSplitActions || showFriendActions;
    const isTappable = !hasActions && !isProcessing;

    return (
      <Pressable
        style={({ pressed }) => [
          styles.notificationCard, 
          { 
            backgroundColor: theme.surface, 
            borderColor: item.read ? theme.border : theme.primary + '40',
            borderWidth: item.read ? 1 : 2,
            opacity: pressed && isTappable ? 0.7 : (item.read ? 0.7 : 1)
          }
        ]}
        onPress={() => isTappable && handleNotificationTap(item)}
        disabled={!isTappable}
      >
        <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
          <Feather name={getNotificationIcon(item.type) as any} size={24} color={iconColor} />
        </View>

        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600', flex: 1, marginBottom: Spacing.xs }]}>
              {item.title}
            </ThemedText>
            {!item.read && !hasActions ? (
              <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />
            ) : null}
          </View>
          <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>
            {item.message}
          </ThemedText>
          <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
            {new Date(item.created_at).toLocaleDateString()}
          </ThemedText>

          {isProcessing ? (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          ) : showSplitActions ? (
            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.acceptButton,
                  { backgroundColor: theme.success, opacity: pressed ? 0.7 : 1 }
                ]}
                onPress={() => handleAccept(item)}
              >
                <ThemedText style={[Typography.body, { color: '#FFFFFF' }]}>
                  Accept
                </ThemedText>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.declineButton,
                  { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 }
                ]}
                onPress={() => handleDecline(item)}
              >
                <ThemedText style={[Typography.body, { color: theme.text }]}>
                  Decline
                </ThemedText>
              </Pressable>
            </View>
          ) : showFriendActions ? (
            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.acceptButton,
                  { backgroundColor: theme.success, opacity: pressed ? 0.7 : 1 }
                ]}
                onPress={() => handleAcceptFriendRequest({ ...item, friendship_id: friendshipId })}
              >
                <ThemedText style={[Typography.body, { color: '#FFFFFF' }]}>
                  Accept
                </ThemedText>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.declineButton,
                  { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 }
                ]}
                onPress={() => handleDeclineFriendRequest({ ...item, friendship_id: friendshipId })}
              >
                <ThemedText style={[Typography.body, { color: theme.text }]}>
                  Decline
                </ThemedText>
              </Pressable>
            </View>
          ) : friendRequestHandled ? (
            <View style={[styles.statusBadge, { backgroundColor: friendshipStatus === 'accepted' ? theme.success + '20' : theme.danger + '20' }]}>
              <Feather 
                name={friendshipStatus === 'accepted' ? 'check-circle' : 'x-circle'} 
                size={14} 
                color={friendshipStatus === 'accepted' ? theme.success : theme.danger} 
              />
              <ThemedText style={[Typography.small, { color: friendshipStatus === 'accepted' ? theme.success : theme.danger, marginLeft: Spacing.xs }]}>
                {friendshipStatus === 'accepted' ? 'Already accepted' : 'Declined'}
              </ThemedText>
            </View>
          ) : null}
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
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText style={[Typography.h1, { color: theme.text }]}>Notifications</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="bell" size={48} color={theme.textSecondary} />
            <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.lg }]}>
              No notifications
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
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  notificationCard: {
    flexDirection: 'row',
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: Spacing.sm,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  actionButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
    alignItems: 'center',
  },
  acceptButton: {},
  declineButton: {},
  processingContainer: {
    marginTop: Spacing.md,
    alignItems: 'flex-start',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
    alignSelf: 'flex-start',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'] * 2,
  },
});
