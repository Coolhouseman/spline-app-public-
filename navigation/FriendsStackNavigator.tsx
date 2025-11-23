import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import FriendsScreen from '@/screens/FriendsScreen';
import AddFriendScreen from '@/screens/AddFriendScreen';
import { useTheme } from '@/hooks/useTheme';
import { getCommonScreenOptions } from './screenOptions';

const Stack = createNativeStackNavigator();

export default function FriendsStackNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Stack.Navigator screenOptions={getCommonScreenOptions({ theme, isDark })}>
      <Stack.Screen 
        name="Friends" 
        component={FriendsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="AddFriend" 
        component={AddFriendScreen}
        options={{ title: 'Add Friend' }}
      />
    </Stack.Navigator>
  );
}
