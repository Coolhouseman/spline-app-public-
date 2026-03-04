import React, { useEffect } from "react";
import { StyleSheet, View, useColorScheme, Platform, ActivityIndicator, Text, AppState, AppStateStatus, Alert, Share } from "react-native";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Linking from "expo-linking";
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from "expo-tracking-transparency";
import { Settings } from "react-native-fbsdk-next";

import MainTabNavigator from "@/navigation/MainTabNavigator";
import AuthStackNavigator from "@/navigation/AuthStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { StripeWrapper } from "@/components/StripeWrapper";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LevelUpProvider } from "@/contexts/LevelUpContext";
import { useTheme } from "@/hooks/useTheme";
import { Colors } from "@/constants/theme";
import { buildDiagnosticReport, getDiagnosticEvents, logDiagnosticEvent } from "@/services/diagnostics.service";
import { supabase } from "@/services/supabase";
import { navigationRef, notifyReady } from "@/utils/RootNavigation";

const Stack = createNativeStackNavigator();

const SPLASH_COLORS = {
  light: '#2563EB',
  dark: '#1e40af',
};
const LINKING_INITIAL_URL_TIMEOUT_MS = 2500;
const DIAGNOSTIC_TAP_THRESHOLD = 6;
const DIAGNOSTIC_TAP_WINDOW_MS = 1800;

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
  const { user, isLoading, isSigningUp, clearSignupOverlay } = useAuth();
  const colorScheme = useColorScheme();
  const [forceUnlocked, setForceUnlocked] = React.useState(false);
  const STARTUP_FORCE_UNLOCK_MS = 12000;
  const SIGNUP_OVERLAY_FORCE_UNLOCK_MS = 15000;
  const ACTIVE_STARTUP_RECOVERY_UNLOCK_MS = 6000;
  const previousBootStateRef = React.useRef<string | null>(null);
  const [appState, setAppState] = React.useState<AppStateStatus>(AppState.currentState);
  const appStateRef = React.useRef<AppStateStatus>(AppState.currentState);
  const clearSignupOverlayRef = React.useRef(clearSignupOverlay);
  const activeStartupUnlockTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isExportingDiagnostics, setIsExportingDiagnostics] = React.useState(false);
  const diagnosticsTapCountRef = React.useRef(0);
  const diagnosticsTapWindowTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    clearSignupOverlayRef.current = clearSignupOverlay;
  }, [clearSignupOverlay]);

  React.useEffect(() => {
    if (!isLoading) {
      setForceUnlocked(false);
      return;
    }

    const timer = setTimeout(() => {
      console.warn(`[Startup] Force-unlocking RootNavigator after ${STARTUP_FORCE_UNLOCK_MS}ms`);
      void logDiagnosticEvent('root_force_unlock_startup_timeout', {
        timeoutMs: STARTUP_FORCE_UNLOCK_MS,
      });
      setForceUnlocked(true);
    }, STARTUP_FORCE_UNLOCK_MS);

    return () => clearTimeout(timer);
  }, [isLoading]);

  React.useEffect(() => {
    const clearActiveStartupUnlockTimer = () => {
      if (activeStartupUnlockTimerRef.current) {
        clearTimeout(activeStartupUnlockTimerRef.current);
        activeStartupUnlockTimerRef.current = null;
      }
    };

    if (!(appState === 'active' && isLoading && !forceUnlocked)) {
      clearActiveStartupUnlockTimer();
      return;
    }

    activeStartupUnlockTimerRef.current = setTimeout(() => {
      console.warn(
        `[Startup] App resumed while loading; forcing unlock after ${ACTIVE_STARTUP_RECOVERY_UNLOCK_MS}ms`
      );
      void logDiagnosticEvent('root_force_unlock_on_active_loading', {
        timeoutMs: ACTIVE_STARTUP_RECOVERY_UNLOCK_MS,
      });
      setForceUnlocked(true);
    }, ACTIVE_STARTUP_RECOVERY_UNLOCK_MS);

    return () => clearActiveStartupUnlockTimer();
  }, [appState, forceUnlocked, isLoading]);

  React.useEffect(() => {
    if (!isSigningUp) {
      return;
    }

    const timer = setTimeout(() => {
      console.warn(
        `[Startup] Force-clearing signup overlay after ${SIGNUP_OVERLAY_FORCE_UNLOCK_MS}ms`
      );
      void logDiagnosticEvent('root_force_clear_signup_overlay_timeout', {
        timeoutMs: SIGNUP_OVERLAY_FORCE_UNLOCK_MS,
      });
      clearSignupOverlayRef.current();
    }, SIGNUP_OVERLAY_FORCE_UNLOCK_MS);

    return () => clearTimeout(timer);
  }, [isSigningUp]);

  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previous = appStateRef.current;
      appStateRef.current = nextState;
      console.log('[Startup] AppState transition:', previous, '->', nextState);
      void logDiagnosticEvent('app_state_transition', { previous, nextState });
      setAppState(nextState);
    });

    return () => subscription.remove();
  }, []);

  // Debug logging - track user state in RootNavigator
  React.useEffect(() => {
    console.log('RootNavigator: user changed to:', user ? user.id : 'null', 'isLoading:', isLoading, 'isSigningUp:', isSigningUp);
  }, [user, isLoading, isSigningUp]);

  React.useEffect(() => {
    const bootState = isLoading
      ? (forceUnlocked ? 'force_unlocked_loading' : 'loading')
      : (user ? 'authenticated' : 'unauthenticated');

    if (previousBootStateRef.current !== bootState) {
      console.log(
        '[Startup] Boot state transition:',
        previousBootStateRef.current,
        '->',
        bootState,
        `appState=${appState}`,
        `isSigningUp=${isSigningUp}`
      );
      previousBootStateRef.current = bootState;
    }
  }, [appState, forceUnlocked, isLoading, isSigningUp, user]);

  // Show loading during initial load
  const handleDiagnosticsPress = async () => {
    if (isExportingDiagnostics) {
      return;
    }
    setIsExportingDiagnostics(true);
    try {
      const report = await buildDiagnosticReport();
      await Share.share({
        title: 'Spline Diagnostics',
        message: report,
      });
      void logDiagnosticEvent('diagnostics_report_shared', { source: 'root_loading' });
    } catch (error) {
      console.error('[Diagnostics] Failed to export diagnostics:', error);
      Alert.alert('Diagnostics Unavailable', 'Could not export diagnostics right now.');
      void logDiagnosticEvent('diagnostics_report_share_error', {
        source: 'root_loading',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsExportingDiagnostics(false);
    }
  };

  const handleHiddenDiagnosticsTap = () => {
    diagnosticsTapCountRef.current += 1;
    if (diagnosticsTapWindowTimerRef.current) {
      clearTimeout(diagnosticsTapWindowTimerRef.current);
    }
    diagnosticsTapWindowTimerRef.current = setTimeout(() => {
      diagnosticsTapCountRef.current = 0;
      diagnosticsTapWindowTimerRef.current = null;
    }, DIAGNOSTIC_TAP_WINDOW_MS);

    if (diagnosticsTapCountRef.current >= DIAGNOSTIC_TAP_THRESHOLD) {
      diagnosticsTapCountRef.current = 0;
      if (diagnosticsTapWindowTimerRef.current) {
        clearTimeout(diagnosticsTapWindowTimerRef.current);
        diagnosticsTapWindowTimerRef.current = null;
      }
      void handleDiagnosticsPress();
    }
  };

  React.useEffect(() => {
    return () => {
      if (diagnosticsTapWindowTimerRef.current) {
        clearTimeout(diagnosticsTapWindowTimerRef.current);
        diagnosticsTapWindowTimerRef.current = null;
      }
    };
  }, []);

  if (isLoading && !forceUnlocked) {
    const splashBg = colorScheme === 'dark' ? SPLASH_COLORS.dark : SPLASH_COLORS.light;
    return (
      <View style={[styles.loading, { backgroundColor: splashBg }]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText} onPress={handleHiddenDiagnosticsTap}>
          {isExportingDiagnostics ? 'Loading diagnostics...' : 'Loading...'}
        </Text>
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
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText} onPress={handleHiddenDiagnosticsTap}>
            {isExportingDiagnostics ? 'Loading diagnostics...' : 'Creating your account...'}
          </Text>
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
  async getInitialURL() {
    try {
      const url = await Promise.race([
        Linking.getInitialURL(),
        new Promise<null>((resolve) =>
          setTimeout(() => {
            console.warn(
              `[Startup] Linking getInitialURL timed out after ${LINKING_INITIAL_URL_TIMEOUT_MS}ms`
            );
            void logDiagnosticEvent('linking_get_initial_url_timeout', {
              timeoutMs: LINKING_INITIAL_URL_TIMEOUT_MS,
            });
            resolve(null);
          }, LINKING_INITIAL_URL_TIMEOUT_MS)
        ),
      ]);
      console.log('[Startup] Linking initial URL:', url ?? 'none');
      void logDiagnosticEvent('linking_initial_url_resolved', {
        hasUrl: Boolean(url),
      });
      return url;
    } catch (error) {
      console.error('[Startup] Linking getInitialURL failed:', error);
      void logDiagnosticEvent('linking_get_initial_url_error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  },
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
  const [isExportingDiagnostics, setIsExportingDiagnostics] = React.useState(false);
  const diagnosticsTapCountRef = React.useRef(0);
  const diagnosticsTapWindowTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleDiagnosticsPress = async () => {
    if (isExportingDiagnostics) {
      return;
    }
    setIsExportingDiagnostics(true);
    try {
      const report = await buildDiagnosticReport();
      await Share.share({
        title: 'Spline Diagnostics',
        message: report,
      });
      void logDiagnosticEvent('diagnostics_report_shared', { source: 'navigation_fallback' });
    } catch (error) {
      console.error('[Diagnostics] Failed to export diagnostics:', error);
      Alert.alert('Diagnostics Unavailable', 'Could not export diagnostics right now.');
      void logDiagnosticEvent('diagnostics_report_share_error', {
        source: 'navigation_fallback',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsExportingDiagnostics(false);
    }
  };

  const handleHiddenDiagnosticsTap = () => {
    diagnosticsTapCountRef.current += 1;
    if (diagnosticsTapWindowTimerRef.current) {
      clearTimeout(diagnosticsTapWindowTimerRef.current);
    }
    diagnosticsTapWindowTimerRef.current = setTimeout(() => {
      diagnosticsTapCountRef.current = 0;
      diagnosticsTapWindowTimerRef.current = null;
    }, DIAGNOSTIC_TAP_WINDOW_MS);

    if (diagnosticsTapCountRef.current >= DIAGNOSTIC_TAP_THRESHOLD) {
      diagnosticsTapCountRef.current = 0;
      if (diagnosticsTapWindowTimerRef.current) {
        clearTimeout(diagnosticsTapWindowTimerRef.current);
        diagnosticsTapWindowTimerRef.current = null;
      }
      void handleDiagnosticsPress();
    }
  };

  React.useEffect(() => {
    return () => {
      if (diagnosticsTapWindowTimerRef.current) {
        clearTimeout(diagnosticsTapWindowTimerRef.current);
        diagnosticsTapWindowTimerRef.current = null;
      }
    };
  }, []);

  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: splashBg }]}>
      <KeyboardProvider>
        <NavigationContainer 
          ref={navigationRef}
          theme={navTheme}
          linking={linking}
          fallback={
            <View style={[styles.loading, { backgroundColor: splashBg }]}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.loadingText} onPress={handleHiddenDiagnosticsTap}>
                {isExportingDiagnostics ? 'Loading diagnostics...' : 'Loading...'}
              </Text>
            </View>
          }
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

  useEffect(() => {
    const dumpRecentDiagnostics = async () => {
      try {
        const events = await getDiagnosticEvents();
        const recent = events.slice(-15);
        if (recent.length > 0) {
          console.log('[Diagnostics] Recent events:', JSON.stringify(recent));
        }
      } catch (error) {
        console.warn('[Diagnostics] Failed to read recent events:', error);
      }
    };
    void dumpRecentDiagnostics();
  }, []);

  useEffect(() => {
    const initializeFacebookSdk = async () => {
      try {
        Settings.setAutoLogAppEventsEnabled(true);

        if (Platform.OS === "ios") {
          let { status } = await getTrackingPermissionsAsync();

          if (status === "undetermined") {
            const result = await requestTrackingPermissionsAsync();
            status = result.status;
          }

          Settings.setAdvertiserTrackingEnabled(status === "granted");
        }

        Settings.initializeSDK();
      } catch (error) {
        console.error("Facebook SDK initialization failed:", error);
      }
    };

    void initializeFacebookSdk();
  }, []);

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
  loadingText: {
    marginTop: 12,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
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
