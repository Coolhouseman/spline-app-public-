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
import type { Notification } from '@/shared/types';

type Props = NativeStackScreenProps<any, 'Notifications'>;

export default function NotificationsScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const notifs = await NotificationsService.getNotifications(user.id);
      setNotifications(notifs);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
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
    if (!user || !notification.friend_request_id) return;
    
    setProcessingId(notification.id);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await FriendsService.acceptFriendRequest(user.id, notification.friend_request_id);
      await NotificationsService.markAsRead(notification.id);
      await loadNotifications();
    } catch (error) {
      console.error('Failed to accept friend request:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeclineFriendRequest = async (notification: Notification) => {
    if (!user || !notification.friend_request_id) return;
    
    setProcessingId(notification.id);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await FriendsService.declineFriendRequest(user.id, notification.friend_request_id);
      await NotificationsService.markAsRead(notification.id);
      await loadNotifications();
    } catch (error) {
      console.error('Failed to decline friend request:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDismiss = async (notification: Notification) => {
    setProcessingId(notification.id);
    try {
      await NotificationsService.markAsRead(notification.id);
      await loadNotifications();
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
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
      case 'friend_request':
        return 'user-plus';
      case 'friend_accepted':
        return 'user-check';
      default:
        return 'bell';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'split_accepted':
      case 'split_paid':
      case 'friend_accepted':
        return theme.success;
      case 'split_declined':
        return theme.danger;
      case 'friend_request':
        return theme.primary;
      default:
        return theme.primary;
    }
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const isProcessing = processingId === item.id;
    const showSplitActions = item.type === 'split_invite' && !item.read;
    // Check for friend_request_id in the column OR in metadata (fallback)
    const friendRequestId = item.friend_request_id || (item.metadata as any)?.friendship_id;
    const showFriendActions = item.type === 'friend_request' && !item.read && friendRequestId;
    const iconColor = getNotificationColor(item.type);

    return (
      <View style={[
        styles.notificationCard, 
        { 
          backgroundColor: theme.surface, 
          borderColor: theme.border,
          opacity: item.read ? 0.7 : 1
        }
      ]}>
        <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
          <Feather name={getNotificationIcon(item.type) as any} size={24} color={iconColor} />
        </View>

        <View style={styles.notificationContent}>
          <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600', marginBottom: Spacing.xs }]}>
            {item.title}
          </ThemedText>
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
                onPress={() => handleAcceptFriendRequest({ ...item, friend_request_id: friendRequestId })}
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
                onPress={() => handleDeclineFriendRequest({ ...item, friend_request_id: friendRequestId })}
              >
                <ThemedText style={[Typography.body, { color: theme.text }]}>
                  Decline
                </ThemedText>
              </Pressable>
            </View>
          ) : !item.read ? (
            <Pressable
              style={({ pressed }) => [
                styles.dismissButton,
                { opacity: pressed ? 0.7 : 1 }
              ]}
              onPress={() => handleDismiss(item)}
            >
              <ThemedText style={[Typography.small, { color: theme.primary }]}>
                Mark as read
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </View>
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
    borderWidth: 1,
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
  dismissButton: {
    marginTop: Spacing.md,
  },
  processingContainer: {
    marginTop: Spacing.md,
    alignItems: 'flex-start',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'] * 2,
  },
});
