import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, FlatList } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { storageService, Notification, generateId } from '@/utils/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<any, 'Notifications'>;

export default function NotificationsScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    const notifs = await storageService.getNotifications();
    setNotifications(notifs);
  };

  const handleAccept = async (notification: Notification) => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const events = await storageService.getEvents();
    const event = events.find(e => e.id === notification.eventId);

    if (event && user) {
      const updatedParticipants = event.participants.map(p =>
        p.uniqueId === user.uniqueId ? { ...p, status: 'paid' as const } : p
      );

      await storageService.updateEvent(notification.eventId, {
        participants: updatedParticipants,
      });
    }

    await storageService.removeNotification(notification.id);
    loadNotifications();
  };

  const handleDecline = async (notification: Notification) => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    const events = await storageService.getEvents();
    const event = events.find(e => e.id === notification.eventId);

    if (event && user) {
      const updatedParticipants = event.participants.map(p =>
        p.uniqueId === user.uniqueId ? { ...p, status: 'declined' as const } : p
      );

      await storageService.updateEvent(notification.eventId, {
        participants: updatedParticipants,
      });
    }

    await storageService.removeNotification(notification.id);
    loadNotifications();
  };

  const renderNotification = ({ item }: { item: Notification }) => (
    <View style={[styles.notificationCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[styles.iconContainer, { backgroundColor: theme.primary + '20' }]}>
        <Feather name="users" size={24} color={theme.primary} />
      </View>

      <View style={styles.notificationContent}>
        <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600', marginBottom: Spacing.xs }]}>
          {item.eventName}
        </ThemedText>
        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>
          {item.initiatorName} invited you to split ${item.amount.toFixed(2)}
        </ThemedText>
        <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
          {new Date(item.timestamp).toLocaleDateString()}
        </ThemedText>

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
      </View>
    </View>
  );

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
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'] * 2,
  },
});
