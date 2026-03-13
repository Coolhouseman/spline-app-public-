import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenKeyboardAwareScrollView } from '@/components/ScreenKeyboardAwareScrollView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { FriendsService } from '@/services/friends.service';
import { PeerPaymentsService } from '@/services/peerPayments.service';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';

type Props = NativeStackScreenProps<any, 'PeerPaymentCreate'>;

const QUICK_EMOJI_MESSAGES = ['🎉 Thanks!', '🍕 For dinner', '☕ Coffee on me', '💸 Sent with love', '🙏 Appreciate you'];

interface FriendWithDetails {
  id: string;
  user_id: string;
  friend_id: string;
  status: string;
  friend_details: {
    id: string;
    unique_id: string;
    name: string;
    email: string;
    profile_picture?: string;
  };
}

export default function PeerPaymentCreateScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const mode = (route.params as { mode?: 'request' | 'pay' } | undefined)?.mode ?? 'pay';

  const [friends, setFriends] = useState<FriendWithDetails[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | undefined>();
  const [receiptBase64, setReceiptBase64] = useState<string | undefined>();
  const [receiptMimeType, setReceiptMimeType] = useState<string | undefined>();
  const [receiptFileName, setReceiptFileName] = useState<string | undefined>();

  useEffect(() => {
    const loadFriends = async () => {
      if (!user?.id) return;
      try {
        setLoadingFriends(true);
        const data = await FriendsService.getFriends(user.id);
        setFriends(data as FriendWithDetails[]);
      } catch (error) {
        console.error('Failed to load friends:', error);
        Alert.alert('Error', 'Failed to load your friends list');
      } finally {
        setLoadingFriends(false);
      }
    };

    void loadFriends();
  }, [user?.id]);

  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friends;
    const query = searchQuery.toLowerCase().trim();
    return friends.filter((friend) => {
      const name = friend.friend_details?.name?.toLowerCase() || '';
      const uniqueId = friend.friend_details?.unique_id || '';
      return name.includes(query) || uniqueId.includes(query);
    });
  }, [friends, searchQuery]);

  const selectedFriend = useMemo(
    () => friends.find((friend) => friend.friend_id === selectedFriendId),
    [friends, selectedFriendId]
  );

  const pickImageFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo library permission');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setReceiptImage(asset.uri);
      setReceiptBase64(asset.base64 ?? undefined);
      setReceiptMimeType(asset.mimeType ?? undefined);
      setReceiptFileName(asset.fileName ?? undefined);
    }
  };

  const captureImageWithCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera permission');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setReceiptImage(asset.uri);
      setReceiptBase64(asset.base64 ?? undefined);
      setReceiptMimeType(asset.mimeType ?? undefined);
      setReceiptFileName(asset.fileName ?? undefined);
    }
  };

  const showReceiptSourceOptions = () => {
    Alert.alert('Add Invoice or Photo', 'Choose how you want to add an optional image', [
      { text: 'Take Photo', onPress: captureImageWithCamera },
      { text: 'Choose from Library', onPress: pickImageFromLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSubmit = async () => {
    if (!user?.id) return;
    if (!title.trim()) {
      Alert.alert('Missing title', 'Please enter a title for this payment');
      return;
    }
    if (!selectedFriend) {
      Alert.alert('Missing friend', 'Please choose one friend');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'request') {
        await PeerPaymentsService.requestPayment({
          requesterId: user.id,
          payerId: selectedFriend.friend_id,
          title: title.trim(),
          amount: parsedAmount,
          receiptUri: receiptImage,
          receiptBase64,
          receiptMimeType,
          receiptFileName,
        });

        Alert.alert('Request sent', `Payment request sent to ${selectedFriend.friend_details.name}`);
      } else {
        await PeerPaymentsService.payFriend({
          payerId: user.id,
          recipientId: selectedFriend.friend_id,
          title: title.trim(),
          message,
          amount: parsedAmount,
          receiptUri: receiptImage,
          receiptBase64,
          receiptMimeType,
          receiptFileName,
        });

        Alert.alert('Payment sent', `You paid ${selectedFriend.friend_details.name}`);
      }

      navigation.getParent()?.reset({
        index: 0,
        routes: [{ name: 'HomeTab', params: { screen: 'MainHome' } }],
      });
    } catch (error: any) {
      console.error('Peer payment failed:', error);
      Alert.alert('Error', error?.message || 'Unable to send peer payment');
    } finally {
      setSubmitting(false);
    }
  };

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
          {mode === 'request' ? 'Request Payment' : 'Pay a Friend'}
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScreenKeyboardAwareScrollView contentContainerStyle={styles.content}>
        <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.sm }]}>
          Title
        </ThemedText>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border },
          ]}
          placeholder="e.g., Dinner"
          placeholderTextColor={theme.textSecondary}
          value={title}
          onChangeText={setTitle}
        />

        <ThemedText
          style={[
            Typography.body,
            { color: theme.textSecondary, marginBottom: Spacing.sm, marginTop: Spacing.lg },
          ]}
        >
          Amount
        </ThemedText>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border },
          ]}
          placeholder="0.00"
          placeholderTextColor={theme.textSecondary}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />

        <View style={styles.sectionHeader}>
          <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
            Friend
          </ThemedText>
          {selectedFriend ? (
            <ThemedText style={[Typography.caption, { color: theme.primary }]}>
              Selected: {selectedFriend.friend_details.name}
            </ThemedText>
          ) : null}
        </View>

        <View
          style={[
            styles.searchInputWrapper,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Feather name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search by name or ID"
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.friendsList}>
          {loadingFriends ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : filteredFriends.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="users" size={40} color={theme.textSecondary} />
              <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.md }]}>
                No friends found.
              </ThemedText>
            </View>
          ) : (
            filteredFriends.map((friend) => {
              const details = friend.friend_details;
              const isSelected = friend.friend_id === selectedFriendId;
              return (
                <Pressable
                  key={friend.id}
                  style={({ pressed }) => [
                    styles.friendCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: isSelected ? theme.primary : theme.border,
                      borderWidth: isSelected ? 2 : 1,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  onPress={() => setSelectedFriendId(friend.friend_id)}
                >
                  <View style={[styles.avatar, { backgroundColor: theme.backgroundSecondary }]}>
                    {details.profile_picture ? (
                      <Image source={{ uri: details.profile_picture }} style={styles.avatarImage} />
                    ) : (
                      <Feather name="user" size={22} color={theme.textSecondary} />
                    )}
                  </View>
                  <View style={styles.friendInfo}>
                    <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
                      {details.name}
                    </ThemedText>
                    <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                      ID: {details.unique_id}
                    </ThemedText>
                  </View>
                  {isSelected ? (
                    <Feather name="check-circle" size={24} color={theme.primary} />
                  ) : (
                    <View style={[styles.checkbox, { borderColor: theme.border }]} />
                  )}
                </Pressable>
              );
            })
          )}
        </View>

        <View style={styles.sectionHeader}>
          <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
            Invoice or Photo
          </ThemedText>
          <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
            Optional
          </ThemedText>
        </View>

        {receiptImage ? (
          <View style={styles.receiptPreviewContainer}>
            <Image source={{ uri: receiptImage }} style={styles.receiptPreview} />
            <Pressable
              style={[styles.removeReceiptButton, { backgroundColor: theme.surface }]}
              onPress={() => {
                setReceiptImage(undefined);
                setReceiptBase64(undefined);
                setReceiptMimeType(undefined);
                setReceiptFileName(undefined);
              }}
            >
              <Feather name="trash-2" size={16} color={theme.danger} />
            </Pressable>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.receiptButton,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          onPress={showReceiptSourceOptions}
        >
          <Feather name="image" size={20} color={theme.primary} />
          <ThemedText style={[Typography.body, { color: theme.text, marginLeft: Spacing.sm }]}>
            {receiptImage ? 'Replace Image' : 'Add Image'}
          </ThemedText>
        </Pressable>

        {mode === 'pay' ? (
          <>
            <View style={styles.sectionHeader}>
              <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
                Add a Message
              </ThemedText>
              <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                Optional
              </ThemedText>
            </View>

            <TextInput
              style={[
                styles.messageInput,
                { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border },
              ]}
              placeholder="Say something nice... emojis welcome"
              placeholderTextColor={theme.textSecondary}
              value={message}
              onChangeText={setMessage}
              multiline
              textAlignVertical="top"
              maxLength={180}
            />

            <View style={styles.emojiRow}>
              {QUICK_EMOJI_MESSAGES.map((item) => (
                <Pressable
                  key={item}
                  style={({ pressed }) => [
                    styles.emojiChip,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                  onPress={() => setMessage((prev) => (prev ? `${prev} ${item}`.trim() : item))}
                >
                  <ThemedText style={[Typography.caption, { color: theme.text }]}>
                    {item}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            {
              backgroundColor: theme.primary,
              opacity: pressed || submitting ? 0.7 : 1,
            },
          ]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '700' }]}>
              {mode === 'request' ? 'Send Request' : 'Send Payment'}
            </ThemedText>
          )}
        </Pressable>
      </ScreenKeyboardAwareScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
  },
  sectionHeader: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.md,
  },
  friendsList: {
    marginTop: Spacing.md,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  friendInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
  },
  receiptPreviewContainer: {
    position: 'relative',
    marginBottom: Spacing.md,
  },
  receiptPreview: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.sm,
  },
  removeReceiptButton: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptButton: {
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  messageInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
    minHeight: 110,
  },
  emojiRow: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  emojiChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  submitButton: {
    marginTop: Spacing['2xl'],
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
