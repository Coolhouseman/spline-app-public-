import React from "react";
import { StyleSheet, ActivityIndicator, View, useColorScheme } from "react-native";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import MainTabNavigator from "@/navigation/MainTabNavigator";
import AuthStackNavigator from "@/navigation/AuthStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Colors } from "@/constants/theme";

const Stack = createNativeStackNavigator();

const SPLASH_COLORS = {
  light: '#2563EB',
  dark: '#1e40af',
};

const LightNavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Colors.light.backgroundRoot,
  },
};

const DarkNavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Colors.dark.backgroundRoot,
  },
};

function RootNavigator() {
  const { user, isLoading } = useAuth();
  const colorScheme = useColorScheme();

  if (isLoading) {
    const splashBg = colorScheme === 'dark' ? SPLASH_COLORS.dark : SPLASH_COLORS.light;
    return (
      <View style={[styles.loading, { backgroundColor: splashBg }]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="Main" component={MainTabNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthStackNavigator} />
      )}
    </Stack.Navigator>
  );
}

function AppContent() {
  const colorScheme = useColorScheme();
  const splashBg = colorScheme === 'dark' ? SPLASH_COLORS.dark : SPLASH_COLORS.light;
  const navTheme = colorScheme === 'dark' ? DarkNavTheme : LightNavTheme;

  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: splashBg }]}>
      <KeyboardProvider>
        <NavigationContainer theme={navTheme}>
          <RootNavigator />
        </NavigationContainer>
        <StatusBar style="auto" />
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  const colorScheme = useColorScheme();
  const splashBg = colorScheme === 'dark' ? SPLASH_COLORS.dark : SPLASH_COLORS.light;

  return (
    <ErrorBoundary>
      <View style={[styles.root, { backgroundColor: splashBg }]}>
        <SafeAreaProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </SafeAreaProvider>
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
