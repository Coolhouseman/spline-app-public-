import React, { useState } from 'react';
import { View, StyleSheet, Modal, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { CardField, useStripe, CardFieldInput } from '@stripe/stripe-react-native';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CardInputModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (paymentMethodId: string, cardDetails: { brand: string; last4: string }) => void;
  clientSecret: string;
  customerId: string;
  setupIntentId: string;
}

export function CardInputModal({
  visible,
  onClose,
  onSuccess,
  clientSecret,
  customerId,
  setupIntentId,
}: CardInputModalProps) {
  const { theme } = useTheme();
  const { confirmSetupIntent } = useStripe();
  const [cardComplete, setCardComplete] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [cardDetails, setCardDetails] = useState<CardFieldInput.Details | null>(null);
  const insets = useSafeAreaInsets();

  const handleCardChange = (details: CardFieldInput.Details) => {
    setCardComplete(details.complete);
    setCardDetails(details);
  };

  const handleConfirm = async () => {
    if (!cardComplete || !clientSecret) {
      Alert.alert('Error', 'Please enter valid card details');
      return;
    }

    setProcessing(true);
    try {
      const { setupIntent, error } = await confirmSetupIntent(clientSecret, {
        paymentMethodType: 'Card',
      });

      if (error) {
        console.error('Setup Intent Error:', error);
        Alert.alert('Error', error.message || 'Failed to add card');
        setProcessing(false);
        return;
      }

      if (setupIntent && setupIntent.paymentMethodId) {
        const brand = cardDetails?.brand || 'card';
        const last4 = cardDetails?.last4 || '****';
        onSuccess(setupIntent.paymentMethodId, { brand, last4 });
      }
    } catch (error: any) {
      console.error('Card setup error:', error);
      Alert.alert('Error', error.message || 'Failed to add card');
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    if (!processing) {
      setCardComplete(false);
      setCardDetails(null);
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <Pressable style={styles.dismissArea} onPress={handleClose} />
          <View 
            style={[
              styles.modalContent, 
              { 
                backgroundColor: theme.background,
                paddingBottom: Math.max(insets.bottom, Spacing.lg) + Spacing.md,
              }
            ]}
          >
            <ScrollView 
              bounces={false}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.header}>
                <ThemedText style={[Typography.h2, { color: theme.text }]}>
                  Add Payment Card
                </ThemedText>
                <Pressable onPress={handleClose} disabled={processing}>
                  <Feather name="x" size={24} color={theme.textSecondary} />
                </Pressable>
              </View>

              <View style={styles.cardFieldContainer}>
                <ThemedText style={[Typography.small, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>
                  Card Details
                </ThemedText>
                <CardField
                  postalCodeEnabled={false}
                  placeholders={{
                    number: '4242 4242 4242 4242',
                  }}
                  cardStyle={{
                    backgroundColor: theme.backgroundSecondary,
                    textColor: theme.text,
                    borderColor: theme.border,
                    borderWidth: 1,
                    borderRadius: BorderRadius.md,
                    fontSize: 16,
                    placeholderColor: theme.textSecondary,
                  }}
                  style={styles.cardField}
                  onCardChange={handleCardChange}
                />
              </View>

              <View style={[styles.securityNotice, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="lock" size={16} color={theme.success} />
                <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginLeft: Spacing.xs, flex: 1 }]}>
                  Your card details are securely processed. We never store your full card number.
                </ThemedText>
              </View>

              <View style={styles.buttonContainer}>
                <Pressable
                  style={[styles.button, styles.cancelButton, { backgroundColor: theme.backgroundSecondary }]}
                  onPress={handleClose}
                  disabled={processing}
                >
                  <ThemedText style={[Typography.body, { color: theme.text }]}>
                    Cancel
                  </ThemedText>
                </Pressable>
                
                <Pressable
                  style={[
                    styles.button,
                    styles.confirmButton,
                    { backgroundColor: cardComplete && !processing ? theme.primary : theme.border }
                  ]}
                  onPress={handleConfirm}
                  disabled={!cardComplete || processing}
                >
                  {processing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                      Add Card
                    </ThemedText>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  cardFieldContainer: {
    marginBottom: Spacing.lg,
  },
  cardField: {
    width: '100%',
    height: 50,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {},
  confirmButton: {},
});
