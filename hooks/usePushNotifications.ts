import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import type { Subscription } from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import { PushNotificationsService } from '@/services/pushNotifications.service';
import { NotificationsService } from '@/services/notifications.service';

export function usePushNotifications(userId: string | undefined) {
  const notificationListener = useRef<Subscription | null>(null);
  const responseListener = useRef<Subscription | null>(null);
  const navigation = useNavigation<any>();

  useEffect(() => {
    if (!userId) return;

    const registerAndSetup = async () => {
      await PushNotificationsService.registerForPushNotifications(userId);

      try {
        const unreadCount = await NotificationsService.getUnreadCount(userId);
        await PushNotificationsService.setBadgeCount(unreadCount);
      } catch (error) {
        console.error('Failed to set initial badge count:', error);
      }
    };

    registerAndSetup();

    notificationListener.current = PushNotificationsService.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification);
      }
    );

    responseListener.current = PushNotificationsService.addNotificationResponseListener(
      (response) => {
        console.log('Notification response:', response);
        const data = response.notification.request.content.data;
        
        try {
          if (data?.splitEventId) {
            navigation.navigate('HomeTab', {
              screen: 'EventDetail',
              params: { eventId: data.splitEventId },
            });
          } else {
            navigation.navigate('HomeTab', {
              screen: 'Notifications',
            });
          }
        } catch (error) {
          console.error('Navigation error:', error);
        }
      }
    );

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && userId) {
        try {
          const unreadCount = await NotificationsService.getUnreadCount(userId);
          await PushNotificationsService.setBadgeCount(unreadCount);
        } catch (error) {
          console.error('Failed to update badge count:', error);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
      subscription.remove();
    };
  }, [userId, navigation]);
}
