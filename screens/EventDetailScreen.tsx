import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Image, ScrollView, Alert, Modal, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { SplitsService } from '@/services/splits.service';
import { WalletService } from '@/services/wallet.service';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeBottomTabBarHeight } from '@/hooks/useSafeBottomTabBarHeight';
import { resolveBackendOrigin } from '@/utils/backend';

const BACKEND_URL = resolveBackendOrigin();

type Props = NativeStackScreenProps<any, 'EventDetail'>;

export default function EventDetailScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useSafeBottomTabBarHeight();
  const { eventId } = route.params as { eventId: string };
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [imageVisible, setImageVisible] = useState(false);

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    try {
      setLoading(true);
      const data = await SplitsService.getSplitDetails(eventId);
      setEvent(data);
    } catch (error) {
      console.error('Failed to load event:', error);
      setEvent(null);
      Alert.alert(
        'Error', 
        'Failed to load event details. Please try again.',
        [
          { text: 'Retry', onPress: loadEvent },
          { text: 'Go Back', onPress: () => navigation.goBack() }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!user || !event) return;
    
    try {
      await SplitsService.respondToSplit(user.id, eventId, 'accepted');
      Alert.alert('Success', 'You accepted this split request');
      loadEvent();
    } catch (error) {
      console.error('Failed to accept split:', error);
      Alert.alert('Error', 'Failed to accept split');
    }
  };

  const handleDecline = async () => {
    if (!user || !event) return;
    
    Alert.alert(
      'Decline Split',
      'Are you sure you want to decline this split?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            try {
              await SplitsService.respondToSplit(user.id, eventId, 'declined');
              Alert.alert('Declined', 'You declined this split request');
              navigation.goBack();
            } catch (error) {
              console.error('Failed to decline split:', error);
              Alert.alert('Error', 'Failed to decline split');
            }
          },
        },
      ]
    );
  };

  const handlePayment = async () => {
    if (!event || !user) return;

    try {
      const wallet = await WalletService.getWallet(user.id);
      
      if (!wallet.bank_connected || !wallet.blinkpay_consent_id) {
        Alert.alert(
          'Bank Not Connected',
          'You need to connect your bank account to make payments. Would you like to connect now?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Connect Bank',
              onPress: async () => {
                navigation.navigate('Wallet');
              }
            }
          ]
        );
        return;
      }

      const myParticipant = event.participants?.find((p: any) => p.user_id === user.id);
      if (!myParticipant) return;

      const paymentAmount = parseFloat(myParticipant.amount);
      
      const paymentResponse = await fetch(`${BACKEND_URL}/api/blinkpay/payment/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          consentId: wallet.blinkpay_consent_id,
          amount: paymentAmount.toFixed(2),
          particulars: event.name.substring(0, 12),
          reference: eventId.substring(0, 12)
        }),
      });

      if (!paymentResponse.ok) {
        throw new Error('Failed to create payment');
      }

      const payment = await paymentResponse.json();

      const statusResponse = await fetch(`${BACKEND_URL}/api/blinkpay/payment/${payment.paymentId}/status?maxWaitSeconds=30`);
      
      if (!statusResponse.ok) {
        throw new Error('Failed to check payment status');
      }

      const paymentResult = await statusResponse.json();
      
      if (paymentResult.status === 'completed' || paymentResult.status === 'AcceptedSettlementCompleted') {
        await SplitsService.paySplit(user.id, eventId);
        Alert.alert('Payment Successful', 'Your payment has been processed');
        loadEvent();
      } else {
        throw new Error('Payment failed or was cancelled');
      }
    } catch (error: any) {
      console.error('Payment failed:', error);
      if (error.message === 'Insufficient balance') {
        Alert.alert('Insufficient Funds', 'Please add funds to your wallet to make this payment');
      } else if (error.message.includes('Bank Not Connected')) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Error', error.message || 'Payment failed. Please try again.');
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return theme.success;
      case 'declined': return theme.danger;
      default: return theme.warning;
    }
  };

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  if (!event) {
    return (
      <ThemedView style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: Spacing.xl }]}>
        <Feather name="alert-circle" size={48} color={theme.textSecondary} style={{ marginBottom: Spacing.lg }} />
        <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center' }]}>
          Event not found
        </ThemedText>
      </ThemedView>
    );
  }

  const isCreator = event.creator_id === user?.id;
  const myParticipation = event.participants?.find((p: any) => p.user_id === user?.id);
  const myAmount = myParticipation?.amount || 0;
  const canRespond = myParticipation && myParticipation.status === 'pending' && !isCreator;
  const canPay = myParticipation && myParticipation.status === 'accepted' && !isCreator;

  return (
    <ThemedView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: tabBarHeight + Spacing.xl }
        ]}
      >
        <View style={[styles.summary, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {isCreator ? (
            <View style={[styles.initiatorBadge, { backgroundColor: theme.primary }]}>
              <ThemedText style={[Typography.caption, { color: '#FFFFFF' }]}>
                You are the creator
              </ThemedText>
            </View>
          ) : (
            <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
              Created by {event.creator?.name || 'Unknown'}
            </ThemedText>
          )}

          <ThemedText style={[Typography.h1, { color: theme.text, marginTop: Spacing.md, marginBottom: Spacing.sm }]}>
            {event.name}
          </ThemedText>

          <ThemedText style={[Typography.hero, { color: theme.text }]}>
            ${parseFloat(event.total_amount).toFixed(2)}
          </ThemedText>
          <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
            Your share: ${parseFloat(myAmount).toFixed(2)}
          </ThemedText>
        </View>

        {event.receipt_image ? (
          <View style={styles.receiptSection}>
            <ThemedText style={[Typography.h2, { color: theme.text, marginBottom: Spacing.md }]}>
              Receipt
            </ThemedText>
            <Pressable onPress={() => setImageVisible(true)}>
              <Image 
                source={{ uri: event.receipt_image }} 
                style={[styles.receiptImage, { borderColor: theme.border }]}
              />
              <View style={styles.zoomHint}>
                <Feather name="maximize-2" size={16} color={theme.textSecondary} />
                <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginLeft: Spacing.xs }]}>
                  Tap to enlarge
                </ThemedText>
              </View>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.participantsSection}>
          <ThemedText style={[Typography.h2, { color: theme.text, marginBottom: Spacing.md }]}>
            Participants
          </ThemedText>

          {event.participants?.map((participant: any) => (
            <View
              key={participant.user_id}
              style={[styles.participantCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <View style={[styles.avatar, { backgroundColor: theme.backgroundSecondary }]}>
                {participant.user?.profile_picture ? (
                  <Image source={{ uri: participant.user.profile_picture }} style={styles.avatarImage} />
                ) : (
                  <Feather name="user" size={20} color={theme.textSecondary} />
                )}
              </View>
              <View style={styles.participantInfo}>
                <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
                  {participant.user?.name || 'Unknown'}
                </ThemedText>
                <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                  ${parseFloat(participant.amount).toFixed(2)}
                </ThemedText>
              </View>
              <View 
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(participant.status) }
                ]}
              >
                <ThemedText style={[Typography.small, { color: '#FFFFFF' }]}>
                  {getStatusText(participant.status)}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>

        {canRespond ? (
          <View style={styles.actionButtons}>
            <Pressable
              style={({ pressed }) => [
                styles.declineButton,
                { borderColor: theme.danger, opacity: pressed ? 0.7 : 1 }
              ]}
              onPress={handleDecline}
            >
              <ThemedText style={[Typography.body, { color: theme.danger, fontWeight: '600' }]}>
                Decline
              </ThemedText>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.acceptButton,
                { backgroundColor: theme.success, opacity: pressed ? 0.7 : 1 }
              ]}
              onPress={handleAccept}
            >
              <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                Accept
              </ThemedText>
            </Pressable>
          </View>
        ) : canPay ? (
          <Pressable
            style={({ pressed }) => [
              styles.payButton,
              { backgroundColor: theme.primary, opacity: pressed ? 0.7 : 1 }
            ]}
            onPress={handlePayment}
          >
            <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
              Pay ${parseFloat(myAmount).toFixed(2)}
            </ThemedText>
          </Pressable>
        ) : null}
      </ScrollView>

      <Modal
        visible={imageVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setImageVisible(false)}
        >
          <View style={styles.modalContent}>
            <Pressable
              style={[styles.closeButton, { backgroundColor: theme.backgroundRoot }]}
              onPress={() => setImageVisible(false)}
            >
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
            {event?.receipt_image ? (
              <Image 
                source={{ uri: event.receipt_image }} 
                style={styles.fullImage}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.xl,
  },
  summary: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.xl,
    alignItems: 'center',
  },
  initiatorBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  receiptSection: {
    marginBottom: Spacing.xl,
  },
  receiptImage: {
    width: '100%',
    height: 300,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  zoomHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    justifyContent: 'center',
  },
  participantsSection: {
    marginBottom: Spacing.xl,
  },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  avatar: {
    width: Spacing.avatarMedium,
    height: Spacing.avatarMedium,
    borderRadius: Spacing.avatarMedium / 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  participantInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  declineButton: {
    flex: 1,
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  acceptButton: {
    flex: 1,
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
});
