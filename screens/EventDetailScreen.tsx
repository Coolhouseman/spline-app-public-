import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Image, ScrollView, Alert, Modal } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { storageService, SplitEvent, Participant } from '@/utils/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeBottomTabBarHeight } from '@/hooks/useSafeBottomTabBarHeight';

type Props = NativeStackScreenProps<any, 'EventDetail'>;

export default function EventDetailScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useSafeBottomTabBarHeight();
  const { eventId } = route.params as { eventId: string };
  const [event, setEvent] = useState<SplitEvent | null>(null);
  const [imageVisible, setImageVisible] = useState(false);

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    const events = await storageService.getEvents();
    const found = events.find(e => e.id === eventId);
    if (found) {
      setEvent(found);
    }
  };

  const handlePayment = async () => {
    if (!event || !user) return;

    const wallet = await storageService.getWallet();
    if (wallet.balance < event.myShare) {
      Alert.alert('Insufficient funds', 'Please add funds to your wallet to make this payment');
      return;
    }

    const updatedParticipants = event.participants.map(p =>
      p.uniqueId === user.uniqueId ? { ...p, status: 'paid' as const } : p
    );

    const allPaid = updatedParticipants.every(p => p.status === 'paid');

    await storageService.updateEvent(eventId, {
      participants: updatedParticipants,
      status: allPaid ? 'completed' : 'in_progress',
    });

    await storageService.addTransaction({
      id: Date.now().toString(),
      type: 'payment',
      amount: event.myShare,
      description: `Payment for ${event.name}`,
      date: new Date().toISOString(),
      eventId: event.id,
    });

    Alert.alert('Payment successful', `You paid $${event.myShare.toFixed(2)} for ${event.name}`);
    loadEvent();
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

  if (!event) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
          Event not found
        </ThemedText>
      </ThemedView>
    );
  }

  const isInitiator = event.initiatorId === user?.id;
  const myParticipation = event.participants.find(p => p.uniqueId === user?.uniqueId);
  const canPay = myParticipation && myParticipation.status === 'pending';

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
          {isInitiator ? (
            <View style={[styles.initiatorBadge, { backgroundColor: theme.primary }]}>
              <ThemedText style={[Typography.caption, { color: '#FFFFFF' }]}>
                You are the initiator
              </ThemedText>
            </View>
          ) : (
            <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
              Initiated by {event.initiatorName}
            </ThemedText>
          )}

          <ThemedText style={[Typography.hero, { color: theme.text, marginTop: Spacing.sm }]}>
            ${event.totalAmount.toFixed(2)}
          </ThemedText>
          <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
            Your share: ${event.myShare.toFixed(2)}
          </ThemedText>
        </View>

        {event.receiptImage ? (
          <View style={styles.receiptSection}>
            <ThemedText style={[Typography.h2, { color: theme.text, marginBottom: Spacing.md }]}>
              Receipt
            </ThemedText>
            <Pressable onPress={() => setImageVisible(true)}>
              <Image 
                source={{ uri: event.receiptImage }} 
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

          {event.participants.map((participant) => (
            <View
              key={participant.uniqueId}
              style={[styles.participantCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <View style={[styles.avatar, { backgroundColor: theme.backgroundSecondary }]}>
                {participant.profilePicture ? (
                  <Image source={{ uri: participant.profilePicture }} style={styles.avatarImage} />
                ) : (
                  <Feather name="user" size={20} color={theme.textSecondary} />
                )}
              </View>
              <View style={styles.participantInfo}>
                <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
                  {participant.firstName} {participant.lastName}
                </ThemedText>
                <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                  ${participant.amount.toFixed(2)}
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

        {canPay ? (
          <Pressable
            style={({ pressed }) => [
              styles.payButton,
              { backgroundColor: theme.primary, opacity: pressed ? 0.7 : 1 }
            ]}
            onPress={handlePayment}
          >
            <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
              Pay ${event.myShare.toFixed(2)}
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
            {event?.receiptImage ? (
              <Image 
                source={{ uri: event.receiptImage }} 
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
