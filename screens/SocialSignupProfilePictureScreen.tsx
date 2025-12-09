import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Image, Alert, ActivityIndicator, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenScrollView } from '@/components/ScreenScrollView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import { decode } from 'base64-arraybuffer';

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
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setProfilePicture(result.assets[0].uri);
    }
  };

  const uploadProfilePicture = async (uri: string): Promise<string | null> => {
    try {
      console.log('[ProfilePicture] Starting upload for user:', params.userId);
      
      // Verify session is valid before attempting upload
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('[ProfilePicture] Session error:', sessionError);
        throw new Error('Session error - please try signing in again');
      }
      if (!session) {
        console.error('[ProfilePicture] No active session found');
        throw new Error('No active session - please try signing in again');
      }
      console.log('[ProfilePicture] Session verified for user:', session.user.id);
      
      let fileExt = 'jpg';
      const uriParts = uri.split('.');
      if (uriParts.length > 1) {
        const lastPart = uriParts[uriParts.length - 1].split('?')[0].toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(lastPart)) {
          fileExt = lastPart;
        }
      }
      
      const fileName = `${params.userId}-${Date.now()}.${fileExt}`;
      const filePath = `profile-pictures/${fileName}`;
      const contentType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;

      let uploadData: ArrayBuffer | Blob;

      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }
        uploadData = await response.blob();
      } else {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (!fileInfo.exists) {
          throw new Error('File does not exist at URI');
        }
        
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: 'base64',
        });
        
        if (!base64 || base64.length === 0) {
          throw new Error('Failed to read file as base64');
        }
        
        uploadData = decode(base64);
        console.log('[ProfilePicture] File read successfully, size:', (uploadData as ArrayBuffer).byteLength);
      }

      console.log('[ProfilePicture] Uploading to Supabase storage...');
      const { error: uploadError } = await supabase.storage
        .from('user-uploads')
        .upload(filePath, uploadData, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        console.error('[ProfilePicture] Upload error:', uploadError);
        console.error('[ProfilePicture] Error details:', JSON.stringify(uploadError));
        // Provide more helpful error message
        if (uploadError.message?.includes('policy') || uploadError.message?.includes('RLS') || uploadError.message?.includes('permission')) {
          throw new Error('Storage permission denied. Please contact support.');
        }
        throw new Error(uploadError.message || 'Upload failed');
      }

      const { data: { publicUrl } } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(filePath);

      console.log('[ProfilePicture] Upload successful, URL:', publicUrl);
      return publicUrl;
    } catch (error: any) {
      console.error('[ProfilePicture] Error uploading:', error);
      throw error; // Re-throw to allow caller to handle
    }
  };

  const handleContinue = async () => {
    setLoading(true);
    
    try {
      let avatarUrl: string | null = null;
      
      if (profilePicture) {
        try {
          avatarUrl = await uploadProfilePicture(profilePicture);
        } catch (uploadError: any) {
          console.error('[ProfilePicture] Upload caught error:', uploadError);
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
                });
              },
            },
          ]);
          return;
        }
        
        if (!avatarUrl) {
          Alert.alert('Upload Failed', 'Failed to upload your profile picture. Would you like to try again or skip?', [
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
                });
              },
            },
          ]);
          return;
        }
        
        console.log('[ProfilePicture] Updating user profile with avatar URL...');
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', params.userId);
          
        if (updateError) {
          console.error('[ProfilePicture] Error updating avatar in database:', updateError);
          Alert.alert('Error', 'Failed to save profile picture. Please try again.');
          setLoading(false);
          return;
        }
        console.log('[ProfilePicture] User profile updated successfully');
      }

      setLoading(false);
      navigation.navigate('SocialSignupBio', { 
        userId: params.userId,
        fullName: params.fullName,
        provider: params.provider,
        avatarUrl: avatarUrl,
      });
    } catch (error: any) {
      console.error('[ProfilePicture] handleContinue error:', error);
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
