import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Image, ScrollView, Alert, Modal, ActivityIndicator, TextInput } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useHeaderHeight } from '@react-navigation/elements';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { SplitsService } from '@/services/splits.service';
import { WalletService } from '@/services/wallet.service';
import { FriendsService } from '@/services/friends.service';
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
  const headerHeight = useHeaderHeight();
  const { eventId } = route.params as { eventId: string };
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [imageVisible, setImageVisible] = useState(false);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [addingFriend, setAddingFriend] = useState<string | null>(null);
  const [amountModalVisible, setAmountModalVisible] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');

  useEffect(() => {
    loadEvent();
    loadFriendIds();
  }, [eventId, user?.id]);

  const loadFriendIds = async () => {
    if (!user?.id) return;
    try {
      const friends = await FriendsService.getFriends(user.id);
      const ids = new Set(friends.map((f: any) => f.friend_details?.id || f.friend_id));
      setFriendIds(ids);
      
      const pendingRequests = await FriendsService.getPendingRequests(user.id);
      const sentRequests = await FriendsService.getSentPendingRequests(user.id);
      const pendingUserIds = new Set([
        ...pendingRequests.map((r: any) => r.user_id),
        ...sentRequests.map((r: any) => r.friend_id)
      ]);
      setPendingIds(pendingUserIds);
    } catch (error) {
      console.error('Failed to load friends:', error);
    }
  };

  const handleAddFriend = async (participantId: string) => {
    if (!user?.id || participantId === user.id) return;
    
    if (friendIds.has(participantId)) {
      Alert.alert('Already Friends', 'You are already friends with this person.');
      return;
    }
    
    if (pendingIds.has(participantId)) {
      Alert.alert('Request Pending', 'A friend request is already pending.');
      return;
    }
    
    try {
      setAddingFriend(participantId);
      await FriendsService.sendFriendRequestById(user.id, participantId);
      setPendingIds(prev => new Set([...prev, participantId]));
      Alert.alert('Request Sent', 'Friend request has been sent! They will appear in your friends list once they accept.');
      await loadFriendIds();
    } catch (error: any) {
      const message = error.message || 'Failed to send friend request';
      if (message.includes('Already friends')) {
        await loadFriendIds();
        Alert.alert('Already Friends', 'You are already friends with this person.');
      } else if (message.includes('already sent') || message.includes('pending')) {
        setPendingIds(prev => new Set([...prev, participantId]));
        Alert.alert('Request Pending', 'A friend request is already pending. Check your Friends tab to accept or view the request.');
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setAddingFriend(null);
    }
  };

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
    
    if (event.split_type === 'specified') {
      setAmountModalVisible(true);
    } else {
      try {
        await SplitsService.respondToSplit(user.id, eventId, 'accepted');
        Alert.alert('Success', 'You accepted this split request');
        loadEvent();
      } catch (error) {
        console.error('Failed to accept split:', error);
        Alert.alert('Error', 'Failed to accept split');
      }
    }
  };

  const handleAcceptWithAmount = async () => {
    if (!user || !event) return;
    
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0');
      return;
    }

    const totalAmount = parseFloat(event.total_amount);
    if (amount > totalAmount) {
      Alert.alert('Invalid Amount', 'Your share cannot exceed the total amount');
      return;
    }

    try {
      await SplitsService.respondToSplitWithAmount(user.id, eventId, 'accepted', amount);
      setAmountModalVisible(false);
      setCustomAmount('');
      Alert.alert('Success', 'You accepted this split and entered your share');
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
      const myParticipant = event.participants?.find((p: any) => p.user_id === user.id);
      if (!myParticipant) return;

      const participantAmount = parseFloat(myParticipant.amount);
      
      // For specified splits where participant hasn't entered their amount yet, show modal
      if (event.split_type === 'specified' && participantAmount === 0) {
        setPaymentModalVisible(true);
        return;
      }
      
      Alert.alert(
        'Confirm Payment',
        `Pay $${participantAmount.toFixed(2)} for ${event.name}?\n\nPayment will be deducted from your wallet balance if available, otherwise from your connected bank account.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Pay',
            onPress: async () => {
              try {
                await WalletService.paySplitEvent(
                  user.id,
                  eventId,
                  participantAmount,
                  event.creator_id,
                  event.name
                );
                
                await SplitsService.paySplit(user.id, eventId);
                Alert.alert('Payment Successful', 'Your payment has been processed');
                loadEvent();
              } catch (error: any) {
                console.error('Payment failed:', error);
                if (error.message.includes('Insufficient wallet balance')) {
                  Alert.alert(
                    'Connect Bank Required',
                    'You don\'t have enough balance in your wallet. Would you like to connect your bank to complete this payment?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Connect Bank',
                        onPress: () => navigation.navigate('Wallet')
                      }
                    ]
                  );
                } else {
                  Alert.alert('Error', error.message || 'Payment failed. Please try again.');
                }
              }
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Payment failed:', error);
      Alert.alert('Error', error.message || 'Failed to process payment');
    }
  };

  const handlePaymentWithAmount = async () => {
    if (!event || !user) return;
    
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0');
      return;
    }

    const totalAmount = parseFloat(event.total_amount);
    if (amount > totalAmount) {
      Alert.alert('Invalid Amount', 'Your share cannot exceed the total amount');
      return;
    }

    setPaymentModalVisible(false);
    
    Alert.alert(
      'Confirm Payment',
      `Pay $${amount.toFixed(2)} for ${event.name}?\n\nPayment will be deducted from your wallet balance if available, otherwise from your connected bank account.`,
      [
        { 
          text: 'Cancel', 
          style: 'cancel',
          onPress: () => setPaymentAmount('')
        },
        {
          text: 'Pay',
          onPress: async () => {
            try {
              // First update the participant's amount
              await SplitsService.updateParticipantAmount(user.id, eventId, amount);
              
              // Then process the payment
              await WalletService.paySplitEvent(
                user.id,
                eventId,
                amount,
                event.creator_id,
                event.name
              );
              
              await SplitsService.paySplit(user.id, eventId);
              setPaymentAmount('');
              Alert.alert('Payment Successful', 'Your payment has been processed');
              loadEvent();
            } catch (error: any) {
              console.error('Payment failed:', error);
              if (error.message.includes('Insufficient wallet balance')) {
                Alert.alert(
                  'Connect Bank Required',
                  'You don\'t have enough balance in your wallet. Would you like to connect your bank to complete this payment?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Connect Bank',
                      onPress: () => navigation.navigate('Wallet')
                    }
                  ]
                );
              } else {
                Alert.alert('Error', error.message || 'Payment failed. Please try again.');
              }
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return theme.success;
      case 'declined': return theme.danger;
      default: return theme.warning;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'Paid';
      case 'declined': return 'Declined';
      default: return 'Pending';
    }
  };

  const calculateProgress = () => {
    if (!event?.participants) return { paidAmount: 0, totalAmount: 0, percentage: 0 };
    
    const totalAmount = parseFloat(event.total_amount);
    let paidAmount = 0;
    
    for (const participant of event.participants) {
      const participantAmount = parseFloat(participant.amount) || 0;
      
      if (event.split_type === 'specified') {
        if (participant.is_creator || (participant.status === 'paid' && participantAmount > 0)) {
          paidAmount += participantAmount;
        }
      } else {
        if (participant.is_creator || participant.status === 'paid') {
          paidAmount += participantAmount;
        }
      }
    }
    
    const percentage = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;
    return { paidAmount, totalAmount, percentage };
  };

  // Get display status - creator is always "paid"
  const getDisplayStatus = (participant: any) => {
    if (participant.is_creator) return 'paid';
    return participant.status;
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
          { 
            paddingTop: Math.max(headerHeight, insets.top + 56) + Spacing.md,
            paddingBottom: tabBarHeight + Spacing.xl 
          }
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
          {event.split_type === 'specified' && parseFloat(myAmount) === 0 && !isCreator ? (
            <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
              Your share: Enter after accepting
            </ThemedText>
          ) : (
            <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
              Your share: ${parseFloat(myAmount).toFixed(2)}
            </ThemedText>
          )}

          {(() => {
            const { paidAmount, totalAmount, percentage } = calculateProgress();
            return (
              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                    Payment Progress
                  </ThemedText>
                  <ThemedText style={[Typography.caption, { color: theme.text, fontWeight: '600' }]}>
                    ${paidAmount.toFixed(2)} / ${totalAmount.toFixed(2)}
                  </ThemedText>
                </View>
                <View style={[styles.progressBar, { backgroundColor: theme.backgroundSecondary }]}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        backgroundColor: theme.success,
                        width: `${Math.min(percentage, 100)}%`
                      }
                    ]} 
                  />
                </View>
                <ThemedText style={[Typography.small, { color: theme.success, textAlign: 'right', marginTop: 4 }]}>
                  {percentage.toFixed(0)}% collected
                </ThemedText>
              </View>
            );
          })()}
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

          {event.participants?.map((participant: any) => {
            const isCurrentUser = participant.user_id === user?.id;
            const isFriend = friendIds.has(participant.user_id);
            const isPending = pendingIds.has(participant.user_id);
            const showAddFriend = !isCurrentUser && !isFriend && !isPending;
            const isAdding = addingFriend === participant.user_id;
            
            const isSpecifiedSplit = event.split_type === 'specified';
            const participantAmount = parseFloat(participant.amount) || 0;
            const hasEnteredAmount = participant.is_creator || participantAmount > 0;
            const showAmount = !isSpecifiedSplit || hasEnteredAmount;
            
            return (
              <View
                key={participant.user_id}
                style={[styles.participantCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              >
                <View style={[styles.avatarLarge, { backgroundColor: theme.backgroundSecondary }]}>
                  {participant.user?.profile_picture ? (
                    <Image source={{ uri: participant.user.profile_picture }} style={styles.avatarImage} />
                  ) : (
                    <Feather name="user" size={24} color={theme.textSecondary} />
                  )}
                </View>
                <View style={styles.participantInfo}>
                  <View style={styles.participantNameRow}>
                    <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
                      {participant.user?.name || 'Unknown'}
                    </ThemedText>
                    {isCurrentUser ? (
                      <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}> (You)</ThemedText>
                    ) : null}
                  </View>
                  <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                    ID: {participant.user?.unique_id || 'N/A'}
                  </ThemedText>
                  <View style={styles.participantSubRow}>
                    {showAmount ? (
                      <ThemedText style={[Typography.caption, { color: theme.primary, fontWeight: '600' }]}>
                        ${participantAmount.toFixed(2)}
                      </ThemedText>
                    ) : (
                      <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                        Awaiting entry
                      </ThemedText>
                    )}
                    {isPending ? (
                      <View style={[styles.pendingBadge, { backgroundColor: theme.warning + '20' }]}>
                        <Feather name="clock" size={12} color={theme.warning} />
                        <ThemedText style={[Typography.small, { color: theme.warning, marginLeft: 4 }]}>
                          Pending
                        </ThemedText>
                      </View>
                    ) : showAddFriend ? (
                      <Pressable
                        style={({ pressed }) => [
                          styles.addFriendBtn,
                          { 
                            backgroundColor: theme.primary + '15',
                            opacity: pressed || isAdding ? 0.6 : 1
                          }
                        ]}
                        onPress={() => handleAddFriend(participant.user_id)}
                        disabled={isAdding}
                      >
                        <Feather 
                          name={isAdding ? "loader" : "user-plus"} 
                          size={12} 
                          color={theme.primary} 
                        />
                        <ThemedText style={[Typography.small, { color: theme.primary, marginLeft: 4 }]}>
                          {isAdding ? 'Sending...' : 'Add Friend'}
                        </ThemedText>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
                <View 
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(getDisplayStatus(participant)) }
                  ]}
                >
                  <ThemedText style={[Typography.small, { color: '#FFFFFF' }]}>
                    {getStatusText(getDisplayStatus(participant))}
                  </ThemedText>
                </View>
              </View>
            );
          })}
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
              {event?.split_type === 'specified' && parseFloat(myAmount) === 0
                ? 'Pay'
                : `Pay $${parseFloat(myAmount).toFixed(2)}`}
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

      <Modal
        visible={amountModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAmountModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.amountModalContent, { backgroundColor: theme.backgroundRoot }]}>
            <ThemedText style={[Typography.h2, { color: theme.text, marginBottom: Spacing.md }]}>
              Enter Your Share
            </ThemedText>
            <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.lg }]}>
              How much are you paying for this split?
            </ThemedText>
            <TextInput
              style={[styles.amountInput, { 
                backgroundColor: theme.surface, 
                color: theme.text, 
                borderColor: theme.border 
              }]}
              placeholder="0.00"
              placeholderTextColor={theme.textSecondary}
              value={customAmount}
              onChangeText={setCustomAmount}
              keyboardType="decimal-pad"
              autoFocus
            />
            <View style={styles.amountModalButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalCancelButton,
                  { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }
                ]}
                onPress={() => {
                  setAmountModalVisible(false);
                  setCustomAmount('');
                }}
              >
                <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
                  Cancel
                </ThemedText>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalConfirmButton,
                  { backgroundColor: theme.success, opacity: pressed ? 0.7 : 1 }
                ]}
                onPress={handleAcceptWithAmount}
              >
                <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                  Accept
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={paymentModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.amountModalContent, { backgroundColor: theme.backgroundRoot }]}>
            <ThemedText style={[Typography.h2, { color: theme.text, marginBottom: Spacing.md }]}>
              Enter Payment Amount
            </ThemedText>
            <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.lg }]}>
              How much are you paying for this split?
            </ThemedText>
            <TextInput
              style={[styles.amountInput, { 
                backgroundColor: theme.surface, 
                color: theme.text, 
                borderColor: theme.border 
              }]}
              placeholder="0.00"
              placeholderTextColor={theme.textSecondary}
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              keyboardType="decimal-pad"
              autoFocus
            />
            <View style={styles.amountModalButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalCancelButton,
                  { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }
                ]}
                onPress={() => {
                  setPaymentModalVisible(false);
                  setPaymentAmount('');
                }}
              >
                <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
                  Cancel
                </ThemedText>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalConfirmButton,
                  { backgroundColor: theme.primary, opacity: pressed ? 0.7 : 1 }
                ]}
                onPress={handlePaymentWithAmount}
              >
                <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                  Pay
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
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
  avatarLarge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  progressSection: {
    width: '100%',
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  participantInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  participantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: 2,
  },
  addFriendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
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
  amountModalContent: {
    width: '85%',
    padding: Spacing.xl,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  amountInput: {
    width: '100%',
    height: 56,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.lg,
    fontSize: 24,
    textAlign: 'center',
  },
  amountModalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
    width: '100%',
  },
  modalCancelButton: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  modalConfirmButton: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
