import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushNotificationData {
  title: string;
  body: string;
  data?: Record<string, any>;
}

export class PushNotificationsService {
  static async registerForPushNotifications(userId: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      console.log('Push notifications not supported on web');
      return null;
    }

    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permission denied');
        return null;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Split Notifications',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#2563EB',
        });
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });

      const pushToken = tokenData.data;
      console.log('Got push token:', pushToken);

      await this.savePushToken(userId, pushToken);

      return pushToken;
    } catch (error) {
      console.error('Failed to register for push notifications:', error);
      return null;
    }
  }

  static async savePushToken(userId: string, pushToken: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('users')
        .update({ push_token: pushToken })
        .eq('id', userId);

      if (error) {
        console.error('Failed to save push token:', error);
      } else {
        console.log('Push token saved successfully');
      }
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  }

  static async removePushToken(userId: string): Promise<void> {
    try {
      await supabase
        .from('users')
        .update({ push_token: null })
        .eq('id', userId);
    } catch (error) {
      console.error('Error removing push token:', error);
    }
  }

  static async getPushToken(userId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('push_token')
        .eq('id', userId)
        .single();

      if (error || !data) return null;
      return data.push_token;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  }

  static async sendPushNotification(
    pushToken: string,
    notification: PushNotificationData
  ): Promise<boolean> {
    try {
      const message = {
        to: pushToken,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
        priority: 'high' as const,
        badge: 1,
      };

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const result = await response.json();
      
      if (result.data?.status === 'ok') {
        console.log('Push notification sent successfully');
        return true;
      } else {
        console.error('Push notification failed:', result);
        return false;
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
      return false;
    }
  }

  static async sendPushToUser(
    userId: string,
    notification: PushNotificationData
  ): Promise<boolean> {
    const pushToken = await this.getPushToken(userId);
    
    if (!pushToken) {
      console.log('No push token found for user:', userId);
      return false;
    }

    return this.sendPushNotification(pushToken, notification);
  }

  static async sendPushToMultipleUsers(
    userIds: string[],
    notification: PushNotificationData
  ): Promise<void> {
    const promises = userIds.map(userId => this.sendPushToUser(userId, notification));
    await Promise.allSettled(promises);
  }

  static addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationReceivedListener(callback);
  }

  static addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ): Notifications.Subscription {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  static async setBadgeCount(count: number): Promise<void> {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('Error setting badge count:', error);
    }
  }

  static async clearBadge(): Promise<void> {
    await this.setBadgeCount(0);
  }
}
