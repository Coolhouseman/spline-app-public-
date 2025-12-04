import React, { useState } from 'react';
import { View, StyleSheet, Modal, Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { CardField, useStripe, CardFieldInput } from '@stripe/stripe-react-native';
import { ThemedText } from '@/components/ThemedText';
import { LoadingOverlay } from '@/components/LoadingOverlay';
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

  const getFriendlyErrorMessage = (error: any): string => {
    const message = error?.message?.toLowerCase() || '';
    const code = error?.code?.toLowerCase() || '';
    
    if (message.includes('test card') || message.includes('test mode') || 
        message.includes('known test') || code === 'card_declined') {
      return 'Please enter a valid card number. The card you entered cannot be used.';
    }
    
    if (message.includes('expired')) {
      return 'Your card has expired. Please use a different card.';
    }
    
    if (message.includes('insufficient funds') || code === 'insufficient_funds') {
      return 'Your card was declined due to insufficient funds.';
    }
    
    if (message.includes('incorrect cvc') || code === 'incorrect_cvc') {
      return 'The security code (CVC) is incorrect. Please check and try again.';
    }
    
    if (message.includes('no such setupintent') || message.includes('resource_missing')) {
      return 'Card setup session expired. Please try again.';
    }
    
    if (message.includes('declined')) {
      return 'Your card was declined. Please try a different card.';
    }
    
    return error?.message || 'Failed to add card. Please try again.';
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
        Alert.alert('Error', getFriendlyErrorMessage(error));
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
      Alert.alert('Error', getFriendlyErrorMessage(error));
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
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
    >
      <LoadingOverlay visible={processing} message="Adding your card..." fullScreen />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <Pressable 
          style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]} 
          onPress={handleClose}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Pressable 
              style={[
                styles.modalContent, 
                { 
                  backgroundColor: theme.background,
                  marginTop: Math.max(insets.top, Spacing.xl),
                  marginBottom: Math.max(insets.bottom, Spacing.xl),
                }
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.header}>
                <ThemedText style={[Typography.h2, { color: theme.text }]}>
                  Add Payment Card
                </ThemedText>
                <Pressable onPress={handleClose} disabled={processing} hitSlop={8}>
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
            </Pressable>
          </ScrollView>
        </Pressable>
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
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
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
