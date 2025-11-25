import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Image, Alert, Platform, TextInput, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenScrollView } from '@/components/ScreenScrollView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { AuthService } from '@/services/auth.service';
import { supabase } from '@/services/supabase';
import { User } from '@/shared/types';

type Props = NativeStackScreenProps<any, 'ProfileSettings'>;

export default function ProfileSettingsScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { user, logout, updateUser, refreshUser } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioText, setBioText] = useState(user?.bio || '');
  const [savingBio, setSavingBio] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const copyToClipboard = async () => {
    if (user?.unique_id) {
      await Clipboard.setStringAsync(user.unique_id);
      Alert.alert('Copied!', 'Your unique ID has been copied');
    }
  };

  const handleEditProfilePicture = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0];
        if (file && user) {
          setUploading(true);
          try {
            const reader = new FileReader();
            reader.onload = async () => {
              const base64 = reader.result as string;
              await AuthService.uploadProfilePictureWeb(user.id, file, file.name);
              await refreshUser();
              Alert.alert('Success', 'Profile picture updated');
              setUploading(false);
            };
            reader.onerror = () => {
              console.error('File read error');
              Alert.alert('Error', 'Failed to read file');
              setUploading(false);
            };
            reader.readAsDataURL(file);
          } catch (error) {
            console.error('Profile picture upload error:', error);
            Alert.alert('Error', 'Failed to update profile picture');
            setUploading(false);
          }
        }
      };
      input.click();
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0] && user) {
      setUploading(true);
      try {
        await AuthService.uploadProfilePicture(user.id, result.assets[0].uri);
        await refreshUser();
        Alert.alert('Success', 'Profile picture updated');
      } catch (error) {
        console.error('Profile picture upload error:', error);
        Alert.alert('Error', 'Failed to update profile picture');
      } finally {
        setUploading(false);
      }
    }
  };

  const handleSaveBio = async () => {
    if (!user) return;

    setSavingBio(true);
    try {
      await AuthService.updateProfile(user.id, { bio: bioText });
      await updateUser({ bio: bioText });
      setIsEditingBio(false);
      Alert.alert('Success', 'Bio updated');
    } catch (error) {
      console.error('Bio update error:', error);
      Alert.alert('Error', 'Failed to update bio');
    } finally {
      setSavingBio(false);
    }
  };

  const handleCancelEditBio = () => {
    setBioText(user?.bio || '');
    setIsEditingBio(false);
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to logout?');
      if (confirmed) {
        setLoggingOut(true);
        try {
          await logout();
        } finally {
          setLoggingOut(false);
        }
      }
      return;
    }
    
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              await logout();
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  if (!user) return null;

  return (
    <ScreenScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.content}>
        <View style={styles.profileHeader}>
          <Pressable 
            style={styles.avatarContainer}
            onPress={handleEditProfilePicture}
            disabled={uploading}
          >
            <View style={[styles.avatar, { backgroundColor: theme.backgroundSecondary, borderWidth: 3, borderColor: theme.primary }]}>
              {user.profile_picture ? (
                <Image source={{ uri: user.profile_picture }} style={styles.avatarImage} />
              ) : (
                <Feather name="user" size={56} color={theme.textSecondary} />
              )}
            </View>
            <View style={[styles.editBadge, { backgroundColor: theme.primary }]}>
              {uploading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="camera" size={18} color="#FFFFFF" />
              )}
            </View>
          </Pressable>

          <ThemedText style={[Typography.h1, { color: theme.text, marginTop: Spacing.xl, fontSize: 28, fontWeight: '700' }]}>
            {user.name}
          </ThemedText>
          
          <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: Spacing.xs }]}>
            {user.email}
          </ThemedText>

          <Pressable
            style={[styles.idContainer, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
            onPress={copyToClipboard}
          >
            <Feather name="hash" size={14} color={theme.primary} />
            <ThemedText style={[Typography.caption, { color: theme.text, fontWeight: '600', marginLeft: Spacing.xs }]}>
              {user.unique_id}
            </ThemedText>
            <View style={{ flex: 1 }} />
            <Feather name="copy" size={14} color={theme.primary} />
          </Pressable>

          <View style={styles.bioSection}>
            {isEditingBio ? (
              <>
                <TextInput
                  style={[
                    styles.bioInput,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                      color: theme.text,
                    },
                  ]}
                  value={bioText}
                  onChangeText={setBioText}
                  placeholder="Tell us about yourself..."
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  maxLength={150}
                  editable={!savingBio}
                />
                <View style={styles.bioActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.bioButton,
                      { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
                    ]}
                    onPress={handleCancelEditBio}
                    disabled={savingBio}
                  >
                    <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                      Cancel
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.bioButton,
                      { backgroundColor: theme.primary, opacity: pressed ? 0.7 : 1 },
                    ]}
                    onPress={handleSaveBio}
                    disabled={savingBio}
                  >
                    {savingBio ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '600' }]}>
                        Save
                      </ThemedText>
                    )}
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <ThemedText
                  style={[
                    Typography.body,
                    {
                      color: user.bio ? theme.text : theme.textSecondary,
                      textAlign: 'center',
                      fontStyle: user.bio ? 'normal' : 'italic',
                    },
                  ]}
                >
                  {user.bio || 'No bio yet'}
                </ThemedText>
                <Pressable
                  style={({ pressed }) => [
                    styles.editBioButton,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                  onPress={() => setIsEditingBio(true)}
                >
                  <Feather name="edit-2" size={16} color={theme.primary} />
                  <ThemedText style={[Typography.small, { color: theme.primary, marginLeft: Spacing.xs }]}>
                    Edit Bio
                  </ThemedText>
                </Pressable>
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={[Typography.h2, { color: theme.text, marginBottom: Spacing.md }]}>
            Account Info
          </ThemedText>

          <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.infoRow}>
              <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                Email
              </ThemedText>
              <ThemedText style={[Typography.body, { color: theme.text }]}>
                {user.email}
              </ThemedText>
            </View>

            {user.phone ? (
              <>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.infoRow}>
                  <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                    Phone
                  </ThemedText>
                  <ThemedText style={[Typography.body, { color: theme.text }]}>
                    {user.phone}
                  </ThemedText>
                </View>
              </>
            ) : null}

            {user.date_of_birth ? (
              <>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.infoRow}>
                  <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                    Date of Birth
                  </ThemedText>
                  <ThemedText style={[Typography.body, { color: theme.text }]}>
                    {new Date(user.date_of_birth).toLocaleDateString()}
                  </ThemedText>
                </View>
              </>
            ) : null}
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,
            { 
              backgroundColor: theme.surface, 
              borderColor: theme.border,
              opacity: pressed ? 0.7 : 1 
            }
          ]}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color={theme.textSecondary} />
          ) : (
            <>
              <Feather name="log-out" size={20} color={theme.textSecondary} />
              <ThemedText style={[Typography.body, { color: theme.textSecondary, marginLeft: Spacing.md, fontWeight: '600' }]}>
                Sign Out
              </ThemedText>
            </>
          )}
        </Pressable>
      </ThemedView>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  profileHeader: {
    alignItems: 'center',
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing.xl,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  editBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  idContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginTop: Spacing.lg,
  },
  section: {
    marginTop: Spacing.xl,
  },
  infoCard: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  infoRow: {
    paddingVertical: Spacing.md,
  },
  divider: {
    height: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    marginTop: Spacing['2xl'],
    marginBottom: Spacing.xl,
  },
  bioSection: {
    marginTop: Spacing.lg,
    width: '100%',
    alignItems: 'center',
  },
  bioInput: {
    width: '100%',
    minHeight: 80,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    padding: Spacing.md,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  bioActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  bioButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  editBioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
});
