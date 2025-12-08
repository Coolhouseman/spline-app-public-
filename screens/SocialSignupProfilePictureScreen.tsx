import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Image, Alert, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
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
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64data = reader.result as string;
          const base64 = base64data.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);
      
      const base64 = await base64Promise;
      const fileName = `${params.userId}_${Date.now()}.jpg`;
      const filePath = `avatars/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, decode(base64), {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      return null;
    }
  };

  const handleContinue = async () => {
    setLoading(true);
    
    try {
      let avatarUrl: string | null = null;
      
      if (profilePicture) {
        avatarUrl = await uploadProfilePicture(profilePicture);
        
        if (!avatarUrl) {
          Alert.alert('Upload Failed', 'Failed to upload your profile picture. Would you like to try again or skip?', [
            {
              text: 'Try Again',
              onPress: () => setLoading(false),
            },
            {
              text: 'Skip',
              onPress: () => {
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
        
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', params.userId);
          
        if (updateError) {
          console.error('Error updating avatar:', updateError);
          Alert.alert('Error', 'Failed to save profile picture. Please try again.');
          setLoading(false);
          return;
        }
      }

      navigation.navigate('SocialSignupBio', { 
        userId: params.userId,
        fullName: params.fullName,
        provider: params.provider,
        avatarUrl: avatarUrl,
      });
    } catch (error: any) {
      Alert.alert('Error', 'Failed to save profile picture. Please try again.');
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

        <ThemedText style={[Typography.hero, { color: theme.text, marginBottom: Spacing.xl }]}>
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
