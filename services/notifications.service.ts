import { supabase } from './supabase';
import type { Notification } from '@/shared/types';

export class NotificationsService {
  static subscribeToNotifications(
    userId: string,
    onUpdate: () => void
  ): { unsubscribe: () => void } {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const debouncedUpdate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('[NotificationsService] Realtime update triggered');
        onUpdate();
      }, 300);
    };

    const channel = supabase
      .channel(`notifications_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('[NotificationsService] New notification received:', payload.new);
          debouncedUpdate();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          console.log('[NotificationsService] Notification updated');
          debouncedUpdate();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          console.log('[NotificationsService] Notification deleted');
          debouncedUpdate();
        }
      )
      .subscribe((status, err) => {
        console.log('[NotificationsService] Subscription status:', status);
        if (err) {
          console.error('[NotificationsService] Subscription error:', err);
        }
      });

    return {
      unsubscribe: () => {
        console.log('[NotificationsService] Unsubscribing from notifications');
        if (debounceTimer) clearTimeout(debounceTimer);
        supabase.removeChannel(channel);
      },
    };
  }

  static async getNotifications(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Notification[];
  }

  static async markAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) throw error;
  }

  static async markAllAsRead(userId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) throw error;
  }

  static async deleteNotification(notificationId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) throw error;
  }

  static async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) throw error;
    return count || 0;
  }

  static async deleteNotificationsBySplitEventId(splitEventId: string): Promise<void> {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('split_event_id', splitEventId);

    if (error) {
      console.error('Failed to delete notifications for split:', error);
    }
  }
}
