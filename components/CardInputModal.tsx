import React, { useState } from 'react';
import { View, StyleSheet, Modal, Pressable, Platform } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';

interface CardInputModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (paymentMethodId: string, cardDetails: { brand: string; last4: string }) => void;
  clientSecret: string;
  customerId: string;
  setupIntentId: string;
}

let NativeCardInputModal: React.ComponentType<CardInputModalProps> | null = null;

if (Platform.OS !== 'web') {
  NativeCardInputModal = require('./CardInputModal.native').CardInputModal;
}

export function CardInputModal(props: CardInputModalProps) {
  const { theme } = useTheme();

  if (Platform.OS !== 'web' && NativeCardInputModal) {
    return <NativeCardInputModal {...props} />;
  }

  const handleClose = () => {
    props.onClose();
  };

  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
          <View style={styles.header}>
            <ThemedText style={[Typography.h2, { color: theme.text }]}>
              Add Payment Card
            </ThemedText>
            <Pressable onPress={handleClose}>
              <Feather name="x" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>
          
          <View style={[styles.webNotice, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="info" size={20} color={theme.primary} />
            <ThemedText style={[Typography.body, { color: theme.textSecondary, marginLeft: Spacing.sm, flex: 1 }]}>
              Native card input is not available on web. Please use the Expo Go app on your phone to add a card securely.
            </ThemedText>
          </View>
          
          <Pressable
            style={[styles.button, { backgroundColor: theme.backgroundSecondary }]}
            onPress={handleClose}
          >
            <ThemedText style={[Typography.body, { color: theme.text }]}>
              Close
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl + 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  webNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  button: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
