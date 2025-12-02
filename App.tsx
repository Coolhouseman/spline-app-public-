import React, { useEffect, useRef } from "react";
import { StyleSheet, ActivityIndicator, View, useColorScheme, Platform } from "react-native";
import { NavigationContainer, DefaultTheme, DarkTheme, NavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";

import MainTabNavigator from "@/navigation/MainTabNavigator";
import AuthStackNavigator from "@/navigation/AuthStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { StripeWrapper } from "@/components/StripeWrapper";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Colors } from "@/constants/theme";
import { supabase } from "@/services/supabase";

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

const linking = {
  prefixes: [
    Linking.createURL('/'),
    'splitpaymentapp://',
  ],
  config: {
    screens: {
      Auth: {
        screens: {
          ResetPassword: 'reset-password',
        },
      },
    },
  },
};

const parseQueryParams = (url: string): Record<string, string> => {
  const params: Record<string, string> = {};
  try {
    const hashIndex = url.indexOf('#');
    const queryString = hashIndex !== -1 ? url.substring(hashIndex + 1) : '';
    
    if (queryString) {
      queryString.split('&').forEach(param => {
        const [key, value] = param.split('=');
        if (key && value) {
          params[decodeURIComponent(key)] = decodeURIComponent(value);
        }
      });
    }
    
    const questionIndex = url.indexOf('?');
    if (questionIndex !== -1) {
      const searchParams = url.substring(questionIndex + 1, hashIndex !== -1 ? hashIndex : undefined);
      searchParams.split('&').forEach(param => {
        const [key, value] = param.split('=');
        if (key && value) {
          params[decodeURIComponent(key)] = decodeURIComponent(value);
        }
      });
    }
  } catch (error) {
    console.error('Error parsing URL params:', error);
  }
  return params;
};

const handlePasswordResetDeepLink = async (url: string) => {
  try {
    const params = parseQueryParams(url);
    
    if (params.access_token && params.refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });
      
      if (error) {
        console.error('Failed to set session from password reset link:', error);
      } else {
        console.log('Session set from password reset link');
      }
    }
  } catch (error) {
    console.error('Error handling password reset deep link:', error);
  }
};

function AppContent() {
  const colorScheme = useColorScheme();
  const splashBg = colorScheme === 'dark' ? SPLASH_COLORS.dark : SPLASH_COLORS.light;
  const navTheme = colorScheme === 'dark' ? DarkNavTheme : LightNavTheme;
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      const url = event.url;
      if (url.includes('reset-password') || url.includes('access_token')) {
        await handlePasswordResetDeepLink(url);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl({ url });
      }
    });

    const subscription = Linking.addEventListener('url', handleUrl);
    
    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: splashBg }]}>
      <KeyboardProvider>
        <NavigationContainer 
          ref={navigationRef}
          theme={navTheme}
          linking={linking}
        >
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
        <StripeWrapper>
          <SafeAreaProvider>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </SafeAreaProvider>
        </StripeWrapper>
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
