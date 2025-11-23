import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Image, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenScrollView } from '@/components/ScreenScrollView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';

type Props = NativeStackScreenProps<any, 'ProfileSettings'>;

export default function ProfileSettingsScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { user, logout } = useAuth();

  const copyToClipboard = async () => {
    if (user?.uniqueId) {
      await Clipboard.setStringAsync(user.uniqueId);
      Alert.alert('Copied!', 'Your unique ID has been copied');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
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
          <View style={[styles.avatar, { backgroundColor: theme.backgroundSecondary }]}>
            {user.profilePicture ? (
              <Image source={{ uri: user.profilePicture }} style={styles.avatarImage} />
            ) : (
              <Feather name="user" size={48} color={theme.textSecondary} />
            )}
          </View>

          <ThemedText style={[Typography.h1, { color: theme.text, marginTop: Spacing.lg }]}>
            {user.firstName} {user.lastName}
          </ThemedText>

          <Pressable
            style={[styles.idContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={copyToClipboard}
          >
            <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
              ID: {user.uniqueId}
            </ThemedText>
            <Feather name="copy" size={16} color={theme.primary} />
          </Pressable>

          {user.bio ? (
            <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.lg }]}>
              {user.bio}
            </ThemedText>
          ) : null}
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

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.infoRow}>
              <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                Phone
              </ThemedText>
              <ThemedText style={[Typography.body, { color: theme.text }]}>
                {user.phone}
              </ThemedText>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.infoRow}>
              <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                Date of Birth
              </ThemedText>
              <ThemedText style={[Typography.body, { color: theme.text }]}>
                {new Date(user.dateOfBirth).toLocaleDateString()}
              </ThemedText>
            </View>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,
            { backgroundColor: theme.danger, opacity: pressed ? 0.7 : 1 }
          ]}
          onPress={handleLogout}
        >
          <Feather name="log-out" size={20} color="#FFFFFF" />
          <ThemedText style={[Typography.body, { color: '#FFFFFF', marginLeft: Spacing.md, fontWeight: '600' }]}>
            Logout
          </ThemedText>
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
    paddingVertical: Spacing.xl,
  },
  avatar: {
    width: Spacing.avatarXLarge,
    height: Spacing.avatarXLarge,
    borderRadius: Spacing.avatarXLarge / 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  idContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    marginTop: Spacing.md,
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
    marginTop: Spacing['2xl'],
  },
});
