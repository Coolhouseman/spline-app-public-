import React from 'react';
import { View, StyleSheet, Pressable, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenScrollView } from '@/components/ScreenScrollView';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';

type Props = NativeStackScreenProps<any, 'SignupComplete'>;

export default function SignupCompleteScreen({ route }: Props) {
  const { theme } = useTheme();
  const { uniqueId } = route.params as { uniqueId: string };

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(uniqueId);
    Alert.alert('Copied!', 'Your unique ID has been copied to clipboard');
  };

  return (
    <ScreenScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: theme.success }]}>
          <Feather name="check" size={48} color={Colors.light.buttonText} />
        </View>

        <ThemedText style={[Typography.hero, { color: theme.text, textAlign: 'center', marginBottom: Spacing.lg }]}>
          Welcome to Split!
        </ThemedText>

        <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center', marginBottom: Spacing['2xl'] }]}>
          Your account has been created successfully
        </ThemedText>

        <View style={[styles.idCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.sm }]}>
            Your Unique ID
          </ThemedText>
          <ThemedText style={[Typography.hero, { color: theme.primary, marginBottom: Spacing.lg }]}>
            {uniqueId}
          </ThemedText>

          <Pressable
            style={({ pressed }) => [
              styles.copyButton,
              { 
                backgroundColor: theme.backgroundSecondary,
                opacity: pressed ? 0.7 : 1
              }
            ]}
            onPress={copyToClipboard}
          >
            <Feather name="copy" size={16} color={theme.primary} />
            <ThemedText style={[Typography.body, { color: theme.primary, marginLeft: Spacing.sm }]}>
              Copy ID
            </ThemedText>
          </Pressable>
        </View>

        <ThemedText style={[Typography.caption, { color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.xl }]}>
          Share this ID with friends to connect and split bills together
        </ThemedText>
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  idCard: {
    width: '100%',
    padding: Spacing.xl,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
  },
});
