import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import type { Subscription } from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import { PushNotificationsService } from '@/services/pushNotifications.service';
import { NotificationsService } from '@/services/notifications.service';

type NotificationType = 
  | 'friend_request' 
  | 'friend_accepted' 
  | 'split_invite' 
  | 'split_accepted' 
  | 'split_declined' 
  | 'split_paid' 
  | 'split_completed' 
  | 'payment_reminder'
  | 'payment_received';

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
        const notificationType = data?.type as NotificationType | undefined;
        
        try {
          // Handle navigation based on notification type
          switch (notificationType) {
            case 'friend_request':
            case 'friend_accepted':
              // Navigate to Friends tab for friend-related notifications
              console.log('Deep linking to FriendsTab for:', notificationType);
              navigation.navigate('FriendsTab', {
                screen: 'Friends',
              });
              break;

            case 'split_invite':
            case 'split_accepted':
            case 'split_declined':
            case 'split_paid':
            case 'split_completed':
            case 'payment_received':
              // Navigate to specific split event if splitEventId is available
              if (data?.splitEventId) {
                console.log('Deep linking to EventDetail for split:', data.splitEventId);
                navigation.navigate('HomeTab', {
                  screen: 'EventDetail',
                  params: { eventId: data.splitEventId },
                });
              } else {
                // Fallback to notifications screen if no splitEventId
                console.log('Deep linking to Notifications (no splitEventId)');
                navigation.navigate('HomeTab', {
                  screen: 'Notifications',
                });
              }
              break;

            case 'payment_reminder':
              // Navigate to notifications screen to see all pending payments
              console.log('Deep linking to Notifications for payment reminder');
              navigation.navigate('HomeTab', {
                screen: 'Notifications',
              });
              break;

            default:
              // For any unknown notification type, check for splitEventId first
              if (data?.splitEventId) {
                console.log('Deep linking to EventDetail (default with splitEventId)');
                navigation.navigate('HomeTab', {
                  screen: 'EventDetail',
                  params: { eventId: data.splitEventId },
                });
              } else if (data?.friendship_id) {
                // If it has a friendship_id, go to Friends
                console.log('Deep linking to FriendsTab (default with friendship_id)');
                navigation.navigate('FriendsTab', {
                  screen: 'Friends',
                });
              } else {
                // Default fallback to notifications screen
                console.log('Deep linking to Notifications (default fallback)');
                navigation.navigate('HomeTab', {
                  screen: 'Notifications',
                });
              }
              break;
          }
        } catch (error) {
          console.error('Navigation error:', error);
          // Fallback: try to navigate to home on error
          try {
            navigation.navigate('HomeTab', { screen: 'MainHome' });
          } catch (fallbackError) {
            console.error('Fallback navigation error:', fallbackError);
          }
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
