import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenScrollView } from '@/components/ScreenScrollView';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';

type Props = NativeStackScreenProps<any, 'PeerPaymentMode'>;

export default function PeerPaymentModeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScreenScrollView contentContainerStyle={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.xl }]}>
        <Pressable
          style={({ pressed }) => [styles.closeButton, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => navigation.goBack()}
        >
          <Feather name="x" size={24} color={theme.text} />
        </Pressable>
      </View>

      <ThemedView style={styles.content}>
        <ThemedText
          style={[
            Typography.h1,
            { color: theme.text, textAlign: 'center', marginBottom: Spacing.md },
          ]}
        >
          Peer to Peer
        </ThemedText>
        <ThemedText
          style={[
            Typography.body,
            {
              color: theme.textSecondary,
              textAlign: 'center',
              marginBottom: Spacing['2xl'],
            },
          ]}
        >
          Send money directly to a friend or request a payment from them.
        </ThemedText>

        <Pressable
          style={({ pressed }) => [
            styles.typeCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          onPress={() => navigation.navigate('PeerPaymentCreate', { mode: 'request' })}
        >
          <View style={[styles.iconContainer, { backgroundColor: theme.primary + '20' }]}>
            <Feather name="arrow-down-left" size={32} color={theme.primary} />
          </View>
          <ThemedText
            style={[
              Typography.h2,
              { color: theme.text, marginTop: Spacing.lg, marginBottom: Spacing.sm },
            ]}
          >
            Request Payment
          </ThemedText>
          <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center' }]}>
            Ask one friend to pay you for something like dinner, tickets, or rent.
          </ThemedText>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.typeCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          onPress={() => navigation.navigate('PeerPaymentCreate', { mode: 'pay' })}
        >
          <View style={[styles.iconContainer, { backgroundColor: theme.secondary + '20' }]}>
            <Feather name="arrow-up-right" size={32} color={theme.secondary} />
          </View>
          <ThemedText
            style={[
              Typography.h2,
              { color: theme.text, marginTop: Spacing.lg, marginBottom: Spacing.sm },
            ]}
          >
            Pay a Friend
          </ThemedText>
          <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center' }]}>
            Send money to one friend now using your wallet balance or saved card.
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
  header: {
    paddingHorizontal: Spacing.xl,
    alignItems: 'flex-end',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  typeCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
