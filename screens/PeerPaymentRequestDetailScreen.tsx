import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, Image, Alert, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenScrollView } from '@/components/ScreenScrollView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { PeerPaymentsService } from '@/services/peerPayments.service';
import type { PeerPayment } from '@/shared/types';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';

type Props = NativeStackScreenProps<any, 'PeerPaymentRequestDetail'>;

type PeerPaymentRecord = PeerPayment & {
  requester?: { id: string; name: string };
  payer?: { id: string; name: string };
  recipient?: { id: string; name: string };
};

export default function PeerPaymentRequestDetailScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const peerPaymentId = (route.params as { peerPaymentId: string }).peerPaymentId;

  const [peerPayment, setPeerPayment] = useState<PeerPaymentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const loadPeerPayment = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await PeerPaymentsService.getPeerPayment(user.id, peerPaymentId);
      setPeerPayment(data as PeerPaymentRecord);
    } catch (error: any) {
      console.error('Failed to load peer payment:', error);
      Alert.alert('Error', error?.message || 'Unable to load payment details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [navigation, peerPaymentId, user?.id]);

  useEffect(() => {
    void loadPeerPayment();
  }, [loadPeerPayment]);

  useFocusEffect(
    useCallback(() => {
      void loadPeerPayment();
    }, [loadPeerPayment])
  );

  const role = useMemo(() => {
    if (!peerPayment || !user?.id) return 'viewer';
    if (peerPayment.payer_id === user.id) return 'payer';
    if (peerPayment.requester_id === user.id) return 'requester';
    if (peerPayment.recipient_id === user.id) return 'recipient';
    return 'viewer';
  }, [peerPayment, user?.id]);

  const counterpartName = useMemo(() => {
    if (!peerPayment || !user?.id) return 'Friend';
    if (role === 'payer') return peerPayment.requester?.name || peerPayment.recipient?.name || 'Friend';
    return peerPayment.payer?.name || 'Friend';
  }, [peerPayment, role, user?.id]);

  const handlePay = async () => {
    if (!user?.id) return;
    setProcessing(true);
    try {
      await PeerPaymentsService.payRequest(user.id, peerPaymentId);
      await loadPeerPayment();
      Alert.alert('Payment sent', 'This peer payment request has been paid.');
    } catch (error: any) {
      console.error('Failed to pay request:', error);
      Alert.alert('Error', error?.message || 'Unable to complete the payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!user?.id) return;
    setProcessing(true);
    try {
      await PeerPaymentsService.declineRequest(user.id, peerPaymentId);
      await loadPeerPayment();
      Alert.alert('Request declined', 'You declined this payment request.');
    } catch (error: any) {
      console.error('Failed to decline request:', error);
      Alert.alert('Error', error?.message || 'Unable to decline this request');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!user?.id) return;
    setProcessing(true);
    try {
      await PeerPaymentsService.cancelRequest(user.id, peerPaymentId);
      await loadPeerPayment();
      Alert.alert('Request cancelled', 'This peer payment request has been cancelled.');
    } catch (error: any) {
      console.error('Failed to cancel request:', error);
      Alert.alert('Error', error?.message || 'Unable to cancel this request');
    } finally {
      setProcessing(false);
    }
  };

  if (loading || !peerPayment) {
    return (
      <ThemedView style={[styles.loadingContainer, { paddingTop: insets.top + Spacing.xl }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  const isPending = peerPayment.status === 'pending';
  const isPaid = peerPayment.status === 'paid';

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText style={[Typography.h1, { color: theme.text, flex: 1, textAlign: 'center' }]}>
          Peer Payment
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScreenScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.amountHeader}>
            <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
              Amount
            </ThemedText>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor:
                    peerPayment.status === 'paid'
                      ? theme.success + '20'
                      : peerPayment.status === 'pending'
                        ? theme.warning + '20'
                        : theme.danger + '20',
                },
              ]}
            >
              <ThemedText
                style={[
                  Typography.caption,
                  {
                    color:
                      peerPayment.status === 'paid'
                        ? theme.success
                        : peerPayment.status === 'pending'
                          ? theme.warning
                          : theme.danger,
                  },
                ]}
              >
                {peerPayment.status.charAt(0).toUpperCase() + peerPayment.status.slice(1)}
              </ThemedText>
            </View>
          </View>

          <ThemedText style={[Typography.hero, { color: theme.text }]}>
            ${Number(peerPayment.amount).toFixed(2)}
          </ThemedText>

          <ThemedText
            style={[
              Typography.h2,
              { color: theme.text, marginTop: Spacing.lg, marginBottom: Spacing.sm },
            ]}
          >
            {peerPayment.title}
          </ThemedText>

          <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
            {role === 'payer'
              ? `${counterpartName} requested this payment from you.`
              : role === 'requester'
                ? `Requested from ${counterpartName}.`
                : `${counterpartName} is the other party on this peer payment.`}
          </ThemedText>

          <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: Spacing.md }]}>
            Created {new Date(peerPayment.created_at).toLocaleString()}
          </ThemedText>
          {peerPayment.paid_at ? (
            <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: Spacing.xs }]}>
              Paid {new Date(peerPayment.paid_at).toLocaleString()}
            </ThemedText>
          ) : null}
        </View>

        {peerPayment.receipt_image ? (
          <View style={[styles.receiptCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ThemedText style={[Typography.h2, { color: theme.text, marginBottom: Spacing.md }]}>
              Invoice or Photo
            </ThemedText>
            <Image source={{ uri: peerPayment.receipt_image }} style={styles.receiptImage} resizeMode="cover" />
          </View>
        ) : null}

        {role === 'payer' && isPending ? (
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.primary, opacity: pressed || processing ? 0.7 : 1 },
              ]}
              onPress={handlePay}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '700' }]}>
                  Pay Now
                </ThemedText>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.surface,
                  opacity: pressed || processing ? 0.7 : 1,
                },
              ]}
              onPress={handleDecline}
              disabled={processing}
            >
              <ThemedText style={[Typography.body, { color: theme.text }]}>Decline</ThemedText>
            </Pressable>
          </View>
        ) : null}

        {role === 'requester' && isPending ? (
          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                borderColor: theme.border,
                backgroundColor: theme.surface,
                opacity: pressed || processing ? 0.7 : 1,
                marginTop: Spacing.xl,
              },
            ]}
            onPress={handleCancel}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color={theme.text} />
            ) : (
              <ThemedText style={[Typography.body, { color: theme.text }]}>Cancel Request</ThemedText>
            )}
          </Pressable>
        ) : null}

        {isPaid ? (
          <View style={[styles.infoBanner, { backgroundColor: theme.success + '15' }]}>
            <ThemedText style={[Typography.body, { color: theme.success }]}>
              This peer payment has been completed successfully.
            </ThemedText>
          </View>
        ) : null}
      </ScreenScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['2xl'],
  },
  card: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    padding: Spacing.xl,
  },
  amountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  statusPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 999,
  },
  receiptCard: {
    marginTop: Spacing.xl,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  receiptImage: {
    width: '100%',
    height: 220,
    borderRadius: BorderRadius.sm,
  },
  actions: {
    marginTop: Spacing.xl,
  },
  primaryButton: {
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButton: {
    marginTop: Spacing.md,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  infoBanner: {
    marginTop: Spacing.xl,
    borderRadius: BorderRadius.sm,
    padding: Spacing.lg,
  },
});
