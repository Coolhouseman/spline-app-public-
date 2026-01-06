import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WalletScreen from '@/screens/WalletScreen';
import WithdrawalScreen from '@/screens/WithdrawalScreen';
import { useTheme } from '@/hooks/useTheme';
import { getCommonScreenOptions } from './screenOptions';

const Stack = createNativeStackNavigator();

export default function WalletStackNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Stack.Navigator screenOptions={getCommonScreenOptions({ theme, isDark })}>
      <Stack.Screen 
        name="Wallet" 
        component={WalletScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Withdrawal" 
        component={WithdrawalScreen}
        options={{ title: 'Withdraw Funds' }}
      />
    </Stack.Navigator>
  );
}
