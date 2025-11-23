import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainHomeScreen from '@/screens/MainHomeScreen';
import EventDetailScreen from '@/screens/EventDetailScreen';
import NotificationsScreen from '@/screens/NotificationsScreen';
import CreateSplitSelectFriendsScreen from '@/screens/CreateSplitSelectFriendsScreen';
import CreateSplitTypeScreen from '@/screens/CreateSplitTypeScreen';
import CreateSplitDetailsScreen from '@/screens/CreateSplitDetailsScreen';
import { useTheme } from '@/hooks/useTheme';
import { getCommonScreenOptions } from './screenOptions';

const Stack = createNativeStackNavigator();

export default function RootStackNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Stack.Navigator screenOptions={getCommonScreenOptions({ theme, isDark })}>
      <Stack.Screen 
        name="MainHome" 
        component={MainHomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="EventDetail" 
        component={EventDetailScreen}
        options={{ title: 'Event Details' }}
      />
      <Stack.Screen 
        name="Notifications" 
        component={NotificationsScreen}
        options={{ headerShown: false, presentation: 'modal' }}
      />
      <Stack.Screen 
        name="CreateSplitType" 
        component={CreateSplitTypeScreen}
        options={{ headerShown: false, presentation: 'modal' }}
      />
      <Stack.Screen 
        name="CreateSplitSelectFriends" 
        component={CreateSplitSelectFriendsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="CreateSplitDetails" 
        component={CreateSplitDetailsScreen}
        options={{ title: 'Event Details' }}
      />
    </Stack.Navigator>
  );
}
