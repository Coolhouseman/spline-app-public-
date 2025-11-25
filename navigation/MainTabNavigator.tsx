import React from "react";
import { View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import RootStackNavigator from "@/navigation/RootStackNavigator";
import FriendsStackNavigator from "@/navigation/FriendsStackNavigator";
import WalletStackNavigator from "@/navigation/WalletStackNavigator";
import ProfileStackNavigator from "@/navigation/ProfileStackNavigator";
import { CustomTabBar } from "@/components/CustomTabBar";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export type MainTabParamList = {
  HomeTab: { screen?: string } | undefined;
  FriendsTab: undefined;
  CreateTab: undefined;
  WalletTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  
  usePushNotifications(user?.id);

  return (
    <Tab.Navigator
        initialRouteName="HomeTab"
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tab.Screen
          name="HomeTab"
          component={RootStackNavigator}
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => (
              <Feather name="home" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="FriendsTab"
          component={FriendsStackNavigator}
          options={{
            title: "Friends",
            tabBarIcon: ({ color, size }) => (
              <Feather name="users" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="CreateTab"
          component={View}
          options={{
            title: "",
            tabBarIcon: () => null,
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
            },
          }}
        />
        <Tab.Screen
          name="WalletTab"
          component={WalletStackNavigator}
          options={{
            title: "Wallet",
            tabBarIcon: ({ color, size }) => (
              <Feather name="credit-card" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="ProfileTab"
          component={ProfileStackNavigator}
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size }) => (
              <Feather name="user" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
  );
}
