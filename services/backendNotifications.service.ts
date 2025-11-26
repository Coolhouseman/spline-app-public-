import Constants from 'expo-constants';
import { supabase } from './supabase';

interface NotificationPayload {
  user_id: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  split_event_id?: string;
  friendship_id?: string;
}

const getBackendUrl = (): string => {
  const extra = Constants.expoConfig?.extra || {};
  return extra.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8082';
};

export class BackendNotificationsService {
  /**
   * Create a notification using the Express backend server
   * Falls back to Supabase RPC if backend is not accessible
   */
  static async createNotification(payload: NotificationPayload): Promise<{ success: boolean; notification?: any; error?: string }> {
    // Try backend server first
    try {
      console.log('Creating notification via backend server for user:', payload.user_id);
      
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/notifications/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: payload.user_id,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          metadata: payload.metadata || {},
          split_event_id: payload.split_event_id || null,
          friend_request_id: payload.friendship_id || null,
        }),
      });

      // Check if response is HTML (indicates backend not accessible)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        console.warn('Backend returned HTML, falling back to Supabase RPC');
        return await this.createNotificationViaSupabase(payload);
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Backend server error:', response.status, errorData);
        return await this.createNotificationViaSupabase(payload);
      }

      const data = await response.json();
      
      if (data.success) {
        console.log('Notification created successfully via backend');
        return { success: true, notification: data.notification };
      } else {
        console.error('Backend returned error:', data.error);
        return await this.createNotificationViaSupabase(payload);
      }
    } catch (error: any) {
      console.error('Failed to call backend server:', error);
      return await this.createNotificationViaSupabase(payload);
    }
  }

  /**
   * Fallback: Create notification via Supabase RPC
   */
  private static async createNotificationViaSupabase(payload: NotificationPayload): Promise<{ success: boolean; notification?: any; error?: string }> {
    try {
      console.log('Attempting notification creation via Supabase RPC for user:', payload.user_id);
      
      const { data, error } = await supabase.rpc('create_notification_v2', {
        p_user_id: payload.user_id,
        p_type: payload.type,
        p_title: payload.title,
        p_message: payload.message,
        p_metadata: payload.metadata || {},
        p_split_event_id: payload.split_event_id || null,
        p_friendship_id: payload.friendship_id || null,
      });

      if (error) {
        console.error('Supabase RPC error:', error);
        // Final fallback: try direct insert (may fail due to RLS)
        return await this.createNotificationDirect(payload);
      }

      if (data && data.success) {
        console.log('Notification created successfully via Supabase RPC');
        return { success: true, notification: data.notification };
      } else {
        console.error('RPC returned error:', data?.error);
        return await this.createNotificationDirect(payload);
      }
    } catch (error: any) {
      console.error('Failed to call Supabase RPC:', error);
      return await this.createNotificationDirect(payload);
    }
  }

  /**
   * Final fallback: Direct insert (may fail if user doesn't own the notification)
   */
  private static async createNotificationDirect(payload: NotificationPayload): Promise<{ success: boolean; notification?: any; error?: string }> {
    try {
      console.log('Attempting direct notification insert for user:', payload.user_id);
      
      const { data, error } = await supabase.from('notifications').insert({
        user_id: payload.user_id,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        metadata: payload.metadata || {},
        split_event_id: payload.split_event_id || null,
        friend_request_id: payload.friendship_id || null,
        read: false,
      }).select().single();

      if (error) {
        console.error('Direct insert error:', error);
        return { success: false, error: error.message };
      }

      console.log('Notification created successfully via direct insert');
      return { success: true, notification: data };
    } catch (error: any) {
      console.error('Failed direct notification insert:', error);
      return { success: false, error: error.message || 'Failed to create notification' };
    }
  }
}
