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

export class BackendNotificationsService {
  /**
   * Create a notification using Supabase RPC
   * This uses a SECURITY DEFINER function that bypasses RLS,
   * allowing authenticated users to create notifications for other users
   */
  static async createNotification(payload: NotificationPayload): Promise<{ success: boolean; notification?: any; error?: string }> {
    try {
      console.log('Creating notification via Supabase RPC for user:', payload.user_id);
      
      const { data, error } = await supabase.rpc('create_notification', {
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
        return { success: false, error: error.message };
      }

      // The RPC returns a JSONB object with success and notification
      if (data && data.success) {
        console.log('Notification created successfully');
        return { success: true, notification: data.notification };
      } else {
        console.error('RPC returned error:', data?.error);
        return { success: false, error: data?.error || 'Failed to create notification' };
      }
    } catch (error: any) {
      console.error('Failed to call Supabase RPC:', error);
      return { success: false, error: error.message || 'Network error' };
    }
  }
}
