import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from '@/screens/WelcomeScreen';
import LoginScreen from '@/screens/LoginScreen';
import ForgotPasswordScreen from '@/screens/ForgotPasswordScreen';
import ResetPasswordScreen from '@/screens/ResetPasswordScreen';
import SignupFirstNameScreen from '@/screens/SignupFirstNameScreen';
import SignupLastNameScreen from '@/screens/SignupLastNameScreen';
import SignupEmailScreen from '@/screens/SignupEmailScreen';
import SignupPasswordScreen from '@/screens/SignupPasswordScreen';
import SignupPhoneScreen from '@/screens/SignupPhoneScreen';
import SignupPhoneOTPScreen from '@/screens/SignupPhoneOTPScreen';
import SignupDOBScreen from '@/screens/SignupDOBScreen';
import SignupProfilePictureScreen from '@/screens/SignupProfilePictureScreen';
import SignupBioScreen from '@/screens/SignupBioScreen';
import SignupCompleteScreen from '@/screens/SignupCompleteScreen';
import SocialSignupPhoneScreen from '@/screens/SocialSignupPhoneScreen';
import SocialSignupPhoneOTPScreen from '@/screens/SocialSignupPhoneOTPScreen';
import SocialSignupDOBScreen from '@/screens/SocialSignupDOBScreen';
import SocialSignupCompleteScreen from '@/screens/SocialSignupCompleteScreen';
import TermsScreen from '@/screens/TermsScreen';
import PrivacyPolicyScreen from '@/screens/PrivacyPolicyScreen';
import { useTheme } from '@/hooks/useTheme';
import { getCommonScreenOptions } from './screenOptions';

const Stack = createNativeStackNavigator();

export default function AuthStackNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Stack.Navigator screenOptions={getCommonScreenOptions({ theme, isDark })}>
      <Stack.Screen 
        name="Welcome" 
        component={WelcomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Login" 
        component={LoginScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="ForgotPassword" 
        component={ForgotPasswordScreen}
        options={{ 
          headerTransparent: true,
          headerTitle: '',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen 
        name="ResetPassword" 
        component={ResetPasswordScreen}
        options={{ 
          headerTransparent: true,
          headerTitle: '',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen 
        name="SignupFirstName" 
        component={SignupFirstNameScreen}
        options={{ 
          headerTransparent: true,
          headerTitle: '',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen 
        name="SignupLastName" 
        component={SignupLastNameScreen}
        options={{ 
          headerTransparent: true,
          headerTitle: '',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen 
        name="SignupEmail" 
        component={SignupEmailScreen}
        options={{ 
          headerTransparent: true,
          headerTitle: '',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen 
        name="SignupPassword" 
        component={SignupPasswordScreen}
        options={{ 
          headerTransparent: true,
          headerTitle: '',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen 
        name="SignupPhone" 
        component={SignupPhoneScreen}
        options={{ 
          headerTransparent: true,
          headerTitle: '',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen 
        name="SignupPhoneOTP" 
        component={SignupPhoneOTPScreen}
        options={{ 
          headerTransparent: true,
          headerTitle: '',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen 
        name="SignupDOB" 
        component={SignupDOBScreen}
        options={{ 
          headerTransparent: true,
          headerTitle: '',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen 
        name="SignupProfilePicture" 
        component={SignupProfilePictureScreen}
        options={{ 
          headerTransparent: true,
          headerTitle: '',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen 
        name="SignupBio" 
        component={SignupBioScreen}
        options={{ 
          headerTransparent: true,
          headerTitle: '',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen 
        name="SignupComplete" 
        component={SignupCompleteScreen}
        options={{ 
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen 
        name="SocialSignupPhone" 
        component={SocialSignupPhoneScreen}
        options={{ 
          headerTransparent: true,
          headerTitle: '',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen 
        name="SocialSignupPhoneOTP" 
        component={SocialSignupPhoneOTPScreen}
        options={{ 
          headerTransparent: true,
          headerTitle: '',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen 
        name="SocialSignupDOB" 
        component={SocialSignupDOBScreen}
        options={{ 
          headerTransparent: true,
          headerTitle: '',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen 
        name="SocialSignupComplete" 
        component={SocialSignupCompleteScreen}
        options={{ 
          headerShown: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen 
        name="Terms" 
        component={TermsScreen}
        options={{ 
          headerTransparent: true,
          headerTitle: 'Terms',
          headerBackTitle: 'Back',
          presentation: 'modal',
        }}
      />
      <Stack.Screen 
        name="PrivacyPolicy" 
        component={PrivacyPolicyScreen}
        options={{ 
          headerTransparent: true,
          headerTitle: 'Privacy',
          headerBackTitle: 'Back',
          presentation: 'modal',
        }}
      />
    </Stack.Navigator>
  );
}
