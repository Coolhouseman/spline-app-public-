import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Image, Alert, Platform, TextInput, ActivityIndicator, Modal, Linking, KeyboardAvoidingView, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as MailComposer from 'expo-mail-composer';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenScrollView } from '@/components/ScreenScrollView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Spacing, BorderRadius, Typography, Colors } from '@/constants/theme';
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
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportMessage, setSupportMessage] = useState('');
  const [sendingSupport, setSendingSupport] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

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

  const handleSendSupport = async () => {
    if (!user || !supportMessage.trim()) {
      Alert.alert('Error', 'Please enter your message');
      return;
    }

    setSendingSupport(true);
    
    const emailSubject = `Spline Support Request - User #${user.unique_id}`;
    const emailBody = `
SUPPORT REQUEST FROM SPLINE APP

User Information:
- Name: ${user.name}
- Email: ${user.email}
- Unique ID: ${user.unique_id}
- Phone: ${user.phone || 'Not provided'}
- User ID: ${user.id}
- Date of Birth: ${user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString() : 'Not provided'}
- Bio: ${user.bio || 'Not set'}

---

Message:
${supportMessage}

---
Sent from Spline App on ${Platform.OS} at ${new Date().toLocaleString()}
    `.trim();

    try {
      if (Platform.OS === 'web') {
        const mailtoUrl = `mailto:hzeng1217@gmail.com?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
        await Linking.openURL(mailtoUrl);
        Alert.alert('Email Opened', 'Your email app should now be open with the support request. Please send it to complete your request.');
      } else {
        const isAvailable = await MailComposer.isAvailableAsync();
        if (!isAvailable) {
          const mailtoUrl = `mailto:hzeng1217@gmail.com?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
          await Linking.openURL(mailtoUrl);
          Alert.alert('Email Opened', 'Your email app should now be open. Please send it to complete your request.');
        } else {
          await MailComposer.composeAsync({
            recipients: ['hzeng1217@gmail.com'],
            subject: emailSubject,
            body: emailBody,
          });
        }
      }
      setSupportMessage('');
      setShowSupportModal(false);
    } catch (error) {
      console.error('Support email error:', error);
      Alert.alert('Error', 'Could not open email app. Please email hzeng1217@gmail.com directly.');
    } finally {
      setSendingSupport(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await AuthService.deleteAccount();
      setShowDeleteModal(false);
    } catch (error: any) {
      console.error('Delete account error:', error);
      Alert.alert('Error', error.message || 'Failed to delete account. Please try again or contact support.');
    } finally {
      setDeletingAccount(false);
    }
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
            styles.supportButton,
            { 
              backgroundColor: theme.primary, 
              opacity: pressed ? 0.7 : 1 
            }
          ]}
          onPress={() => setShowSupportModal(true)}
        >
          <Feather name="help-circle" size={20} color="#FFFFFF" />
          <ThemedText style={[Typography.body, { color: '#FFFFFF', marginLeft: Spacing.md, fontWeight: '600' }]}>
            Contact Support
          </ThemedText>
        </Pressable>

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

        <Pressable
          style={({ pressed }) => [
            styles.deleteAccountButton,
            { 
              opacity: pressed ? 0.7 : 1 
            }
          ]}
          onPress={() => setShowDeleteModal(true)}
        >
          <Feather name="trash-2" size={18} color={Colors.light.danger} />
          <ThemedText style={[Typography.body, { color: Colors.light.danger, marginLeft: Spacing.sm, fontWeight: '500' }]}>
            Delete Account
          </ThemedText>
        </Pressable>
      </ThemedView>

      <Modal
        visible={showSupportModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowSupportModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <Pressable 
            style={styles.modalBackdrop} 
            onPress={() => {
              setShowSupportModal(false);
              setSupportMessage('');
            }}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[Typography.h2, { color: theme.text }]}>
                Contact Support
              </ThemedText>
              <Pressable
                onPress={() => {
                  setShowSupportModal(false);
                  setSupportMessage('');
                }}
                hitSlop={8}
              >
                <Feather name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.md }]}>
              Describe your issue or question below. Your account information will be included automatically.
            </ThemedText>

            <TextInput
              style={[
                styles.supportInput,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  color: theme.text,
                }
              ]}
              value={supportMessage}
              onChangeText={setSupportMessage}
              placeholder="How can we help you?"
              placeholderTextColor={theme.textSecondary}
              multiline
              textAlignVertical="top"
              maxLength={1000}
              editable={!sendingSupport}
            />

            <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: Spacing.xs, textAlign: 'right' }]}>
              {supportMessage.length}/1000
            </ThemedText>

            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, opacity: pressed ? 0.7 : 1 }
                ]}
                onPress={() => {
                  setShowSupportModal(false);
                  setSupportMessage('');
                }}
                disabled={sendingSupport}
              >
                <ThemedText style={[Typography.body, { color: theme.textSecondary, fontWeight: '600' }]}>
                  Cancel
                </ThemedText>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  { backgroundColor: theme.primary, opacity: pressed || sendingSupport ? 0.7 : 1 }
                ]}
                onPress={handleSendSupport}
                disabled={sendingSupport || !supportMessage.trim()}
              >
                {sendingSupport ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                    Send
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showDeleteModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable 
            style={styles.modalBackdrop} 
            onPress={() => !deletingAccount && setShowDeleteModal(false)}
          />
          <View style={[styles.deleteModalContent, { backgroundColor: theme.background }]}>
            <View style={styles.deleteModalIcon}>
              <Feather name="alert-triangle" size={48} color={Colors.light.danger} />
            </View>

            <ThemedText style={[Typography.h2, { color: theme.text, textAlign: 'center', marginTop: Spacing.lg }]}>
              Delete Account?
            </ThemedText>

            <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.md, lineHeight: 22 }]}>
              This action is permanent and cannot be undone. Before proceeding, please be aware:
            </ThemedText>

            <View style={[styles.warningBox, { backgroundColor: `${Colors.light.danger}10`, borderColor: `${Colors.light.danger}30` }]}>
              <View style={styles.warningItem}>
                <Feather name="x-circle" size={16} color={Colors.light.danger} />
                <ThemedText style={[Typography.small, { color: theme.text, marginLeft: Spacing.sm, flex: 1 }]}>
                  Any remaining wallet balance will be forfeited
                </ThemedText>
              </View>
              <View style={styles.warningItem}>
                <Feather name="x-circle" size={16} color={Colors.light.danger} />
                <ThemedText style={[Typography.small, { color: theme.text, marginLeft: Spacing.sm, flex: 1 }]}>
                  All payment history and splits will be permanently deleted
                </ThemedText>
              </View>
              <View style={styles.warningItem}>
                <Feather name="x-circle" size={16} color={Colors.light.danger} />
                <ThemedText style={[Typography.small, { color: theme.text, marginLeft: Spacing.sm, flex: 1 }]}>
                  Your account cannot be recovered once deleted
                </ThemedText>
              </View>
            </View>

            <ThemedText style={[Typography.caption, { color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.md, fontStyle: 'italic' }]}>
              To avoid losing funds, please withdraw your remaining balance before deleting your account.
            </ThemedText>

            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, opacity: pressed ? 0.7 : 1 }
                ]}
                onPress={() => setShowDeleteModal(false)}
                disabled={deletingAccount}
              >
                <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
                  Cancel
                </ThemedText>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  { backgroundColor: Colors.light.danger, opacity: pressed || deletingAccount ? 0.7 : 1 }
                ]}
                onPress={handleDeleteAccount}
                disabled={deletingAccount}
              >
                {deletingAccount ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                    Delete Account
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xs,
    marginTop: Spacing['2xl'],
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginHorizontal: Spacing.lg,
    width: '90%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  supportInput: {
    minHeight: 150,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    padding: Spacing.md,
    marginTop: Spacing.lg,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing['2xl'],
  },
  deleteModalContent: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginHorizontal: Spacing.lg,
    width: '90%',
    maxWidth: 400,
  },
  deleteModalIcon: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  warningBox: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: Spacing.xs,
  },
});
