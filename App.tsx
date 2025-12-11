import React, { useEffect } from "react";
import { StyleSheet, View, useColorScheme, Platform } from "react-native";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
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
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LevelUpProvider } from "@/contexts/LevelUpContext";
import { useTheme } from "@/hooks/useTheme";
import { Colors } from "@/constants/theme";
import { supabase } from "@/services/supabase";
import { navigationRef, notifyReady } from "@/utils/RootNavigation";

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
  const { user, isLoading, isSigningUp } = useAuth();
  const colorScheme = useColorScheme();

  // Debug logging - track user state in RootNavigator
  React.useEffect(() => {
    console.log('RootNavigator: user changed to:', user ? user.id : 'null', 'isLoading:', isLoading, 'isSigningUp:', isSigningUp);
  }, [user, isLoading, isSigningUp]);

  // Show loading during initial load
  if (isLoading) {
    const splashBg = colorScheme === 'dark' ? SPLASH_COLORS.dark : SPLASH_COLORS.light;
    return (
      <View style={[styles.loading, { backgroundColor: splashBg }]}>
        <LoadingOverlay visible={true} message="Loading..." />
      </View>
    );
  }

  console.log('RootNavigator rendering: user is', user ? 'authenticated' : 'null');

  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator 
        key={user ? 'authenticated' : 'unauthenticated'}
        screenOptions={{ headerShown: false }}
      >
        {user ? (
          <Stack.Screen name="Main" component={MainTabNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthStackNavigator} />
        )}
      </Stack.Navigator>
      {/* Overlay loading on top of navigator during signup - keeps navigator mounted */}
      {isSigningUp && (
        <View style={[styles.loading, styles.overlay, { backgroundColor: colorScheme === 'dark' ? SPLASH_COLORS.dark : SPLASH_COLORS.light }]}>
          <LoadingOverlay visible={true} message="Creating your account..." />
        </View>
      )}
    </View>
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
          onReady={notifyReady}
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
      <AuthProvider>
        <LevelUpProvider>
          <View style={[styles.root, { backgroundColor: splashBg }]}>
            <StripeWrapper>
              <SafeAreaProvider>
                <AppContent />
              </SafeAreaProvider>
            </StripeWrapper>
          </View>
        </LevelUpProvider>
      </AuthProvider>
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
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
  },
});
