import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Subscription } from 'expo-notifications';
import { PushNotificationsService } from '@/services/pushNotifications.service';
import { NotificationsService } from '@/services/notifications.service';
import * as RootNavigation from '@/utils/RootNavigation';

type NotificationType = 
  | 'friend_request' 
  | 'friend_accepted' 
  | 'split_invite' 
  | 'split_accepted' 
  | 'split_declined' 
  | 'split_paid' 
  | 'split_completed' 
  | 'payment_reminder'
  | 'payment_received'
  | 'split_cancelled';

function handleNotificationNavigation(data: Record<string, any> | undefined, delayMs: number = 0) {
  const notificationType = data?.type as NotificationType | undefined;
  
  console.log('[PushNotification] Handling navigation for type:', notificationType, 'data:', data);
  
  const doNavigation = () => {
    try {
      switch (notificationType) {
        case 'friend_request':
        case 'friend_accepted':
          console.log('[PushNotification] Deep linking to FriendsTab for:', notificationType);
          RootNavigation.navigate('Main', {
            screen: 'FriendsTab',
            params: {
              screen: 'Friends',
            },
          });
          break;

        case 'split_invite':
        case 'split_accepted':
        case 'split_declined':
        case 'split_paid':
        case 'split_completed':
        case 'payment_received':
          if (data?.splitEventId) {
            console.log('[PushNotification] Deep linking to EventDetail for split:', data.splitEventId);
            RootNavigation.navigate('Main', {
              screen: 'HomeTab',
              params: {
                screen: 'EventDetail',
                params: { eventId: data.splitEventId },
              },
            });
          } else {
            console.log('[PushNotification] Deep linking to Notifications (no splitEventId)');
            RootNavigation.navigate('Main', {
              screen: 'HomeTab',
              params: {
                screen: 'Notifications',
              },
            });
          }
          break;

        case 'split_cancelled':
          console.log('[PushNotification] Split was cancelled, navigating to Notifications');
          RootNavigation.navigate('Main', {
            screen: 'HomeTab',
            params: {
              screen: 'Notifications',
            },
          });
          break;

        case 'payment_reminder':
          console.log('[PushNotification] Deep linking to Notifications for payment reminder');
          RootNavigation.navigate('Main', {
            screen: 'HomeTab',
            params: {
              screen: 'Notifications',
            },
          });
          break;

        default:
          if (data?.splitEventId) {
            console.log('[PushNotification] Deep linking to EventDetail (default with splitEventId)');
            RootNavigation.navigate('Main', {
              screen: 'HomeTab',
              params: {
                screen: 'EventDetail',
                params: { eventId: data.splitEventId },
              },
            });
          } else if (data?.friendship_id) {
            console.log('[PushNotification] Deep linking to FriendsTab (default with friendship_id)');
            RootNavigation.navigate('Main', {
              screen: 'FriendsTab',
              params: {
                screen: 'Friends',
              },
            });
          } else {
            console.log('[PushNotification] Deep linking to Notifications (default fallback)');
            RootNavigation.navigate('Main', {
              screen: 'HomeTab',
              params: {
                screen: 'Notifications',
              },
            });
          }
          break;
      }
    } catch (error) {
      console.error('[PushNotification] Navigation error:', error);
      try {
        RootNavigation.navigate('Main', {
          screen: 'HomeTab',
          params: { screen: 'MainHome' },
        });
      } catch (fallbackError) {
        console.error('[PushNotification] Fallback navigation error:', fallbackError);
      }
    }
  };

  if (delayMs > 0) {
    setTimeout(doNavigation, delayMs);
  } else {
    doNavigation();
  }
}

export function usePushNotifications(userId: string | undefined) {
  const notificationListener = useRef<Subscription | null>(null);
  const responseListener = useRef<Subscription | null>(null);
  const initialNotificationHandled = useRef(false);

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

    const checkInitialNotification = async () => {
      if (initialNotificationHandled.current) return;
      
      try {
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastResponse) {
          initialNotificationHandled.current = true;
          console.log('[PushNotification] Handling initial notification response (cold start)');
          const data = lastResponse.notification.request.content.data;
          
          handleNotificationNavigation(data, 1000);
        }
      } catch (error) {
        console.error('[PushNotification] Error checking initial notification:', error);
      }
    };

    setTimeout(() => {
      checkInitialNotification();
    }, 500);

    notificationListener.current = PushNotificationsService.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification);
      }
    );

    responseListener.current = PushNotificationsService.addNotificationResponseListener(
      (response) => {
        console.log('[PushNotification] Notification response received');
        const data = response.notification.request.content.data;
        handleNotificationNavigation(data);
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
  }, [userId]);
}
