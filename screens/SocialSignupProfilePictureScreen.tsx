import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Image, Alert, ActivityIndicator, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenScrollView } from '@/components/ScreenScrollView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { AuthService } from '@/services/auth.service';

type Props = NativeStackScreenProps<any, 'SocialSignupProfilePicture'>;

export default function SocialSignupProfilePictureScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { clearSignupOverlay } = useAuth();
  const [profilePicture, setProfilePicture] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  
  const params = route.params as { 
    userId: string;
    fullName?: string;
    provider: 'apple' | 'google';
    referralCode?: string;
  };

  useEffect(() => {
    clearSignupOverlay();
  }, []);

  const pickImage = async () => {
    const { status: currentStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
    
    if (currentStatus !== 'granted') {
      Alert.alert(
        'Photo Library Access',
        'Spline would like to access your photo library to let you choose a profile picture.',
        [
          {
            text: 'Not Now',
            style: 'cancel',
          },
          {
            text: 'Allow Access',
            onPress: async () => {
              const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (status === 'granted') {
                await launchImagePicker();
              } else {
                Alert.alert(
                  'Permission Required',
                  'To upload a profile picture, please enable photo library access in your device settings.',
                  [{ text: 'OK' }]
                );
              }
            },
          },
        ]
      );
    } else {
      await launchImagePicker();
    }
  };

  const launchImagePicker = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setProfilePicture(result.assets[0].uri);
    }
  };

  const handleContinue = async () => {
    setLoading(true);
    
    try {
      let avatarUrl: string | null = null;
      
      if (profilePicture) {
        try {
          console.log('[SocialSignupProfilePicture] Uploading profile picture using AuthService...');
          avatarUrl = await AuthService.uploadProfilePicture(params.userId, profilePicture);
          console.log('[SocialSignupProfilePicture] Profile picture uploaded successfully:', avatarUrl);
        } catch (uploadError: any) {
          console.error('[SocialSignupProfilePicture] Upload error:', uploadError);
          const errorMessage = uploadError.message || 'Failed to upload your profile picture';
          Alert.alert('Upload Failed', `${errorMessage}. Would you like to try again or skip?`, [
            {
              text: 'Try Again',
              onPress: () => setLoading(false),
            },
            {
              text: 'Skip',
              onPress: () => {
                setLoading(false);
                navigation.navigate('SocialSignupBio', { 
                  userId: params.userId,
                  fullName: params.fullName,
                  provider: params.provider,
                  avatarUrl: null,
                  referralCode: params.referralCode,
                });
              },
            },
          ]);
          return;
        }
      }

      setLoading(false);
      navigation.navigate('SocialSignupBio', { 
        userId: params.userId,
        fullName: params.fullName,
        provider: params.provider,
        avatarUrl: avatarUrl,
        referralCode: params.referralCode,
      });
    } catch (error: any) {
      console.error('[SocialSignupProfilePicture] handleContinue error:', error);
      Alert.alert('Error', error.message || 'Failed to save profile picture. Please try again.');
      setLoading(false);
    }
  };

  const getFirstName = () => {
    if (params.fullName) {
      return params.fullName.split(' ')[0];
    }
    return '';
  };

  return (
    <ScreenScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing['2xl'] }]}>
          Almost Done
        </ThemedText>

        <ThemedText style={[Typography.hero, { color: theme.text, marginBottom: Spacing.xl, textAlign: 'center' }]}>
          {getFirstName() ? `${getFirstName()}, add a profile picture` : 'Add a profile picture'}
        </ThemedText>

        <Pressable
          style={({ pressed }) => [
            styles.avatarContainer,
            { 
              backgroundColor: theme.backgroundSecondary,
              borderColor: theme.border,
              opacity: pressed ? 0.7 : 1
            }
          ]}
          onPress={pickImage}
          disabled={loading}
        >
          {profilePicture ? (
            <Image source={{ uri: profilePicture }} style={styles.avatar} />
          ) : (
            <Feather name="camera" size={40} color={theme.textSecondary} />
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.linkButton, { opacity: pressed ? 0.7 : 1 }]}
          onPress={pickImage}
          disabled={loading}
        >
          <ThemedText style={[Typography.body, { color: theme.primary }]}>
            {profilePicture ? 'Change photo' : 'Choose from gallery'}
          </ThemedText>
        </Pressable>
      </ThemedView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.primary, opacity: pressed || loading ? 0.7 : 1 }
          ]}
          onPress={handleContinue}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.light.buttonText} />
          ) : (
            <ThemedText style={[Typography.body, { color: Colors.light.buttonText, fontWeight: '600' }]}>
              {profilePicture ? 'Continue' : 'Skip for now'}
            </ThemedText>
          )}
        </Pressable>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  avatarContainer: {
    width: Spacing.avatarXLarge,
    height: Spacing.avatarXLarge,
    borderRadius: Spacing.avatarXLarge / 2,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  linkButton: {
    marginTop: Spacing.sm,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  button: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
