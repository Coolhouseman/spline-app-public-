import Constants from 'expo-constants';

const BACKEND_URL = Constants.expoConfig?.extra?.backendUrl || 
  process.env.EXPO_PUBLIC_BACKEND_URL || 
  'https://2cacf204-3854-4ef2-a387-5784f0753fd3-00-aneawyo2yg5h.spock.replit.dev';

interface NotificationPayload {
  user_id: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  split_event_id?: string;
}

export class BackendNotificationsService {
  static async createNotification(payload: NotificationPayload): Promise<{ success: boolean; notification?: any; error?: string }> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/notifications/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Backend notification error:', data);
        return { success: false, error: data.error || 'Failed to create notification' };
      }

      return { success: true, notification: data.notification };
    } catch (error: any) {
      console.error('Failed to call backend notification service:', error);
      return { success: false, error: error.message || 'Network error' };
    }
  }
}
