import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, Image, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenKeyboardAwareScrollView } from '@/components/ScreenKeyboardAwareScrollView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useLevelUp } from '@/contexts/LevelUpContext';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { SplitsService } from '@/services/splits.service';

type Friend = {
  uniqueId: string;
  odooUserId: string;
  firstName: string;
  lastName: string;
  profilePicture: string | null;
};

type Props = NativeStackScreenProps<any, 'CreateSplitDetails'>;

export default function CreateSplitDetailsScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { checkLevelUp } = useLevelUp();
  const { selectedFriends, splitType } = route.params as { selectedFriends: Friend[]; splitType: 'equal' | 'specified' };

  const [eventName, setEventName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [myShare, setMyShare] = useState('');
  const [friendShares, setFriendShares] = useState<{ [key: string]: string }>({});
  const [receiptImage, setReceiptImage] = useState<string | undefined>();
  const [receiptBase64, setReceiptBase64] = useState<string | undefined>();
  const [receiptMimeType, setReceiptMimeType] = useState<string | undefined>();
  const [receiptFileName, setReceiptFileName] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const updateFriendShare = (odooUserId: string, value: string) => {
    setFriendShares(prev => ({ ...prev, [odooUserId]: value }));
  };

  const calculateTotalShares = () => {
    const creatorAmount = parseFloat(myShare) || 0;
    const friendsTotal = Object.values(friendShares).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    return creatorAmount + friendsTotal;
  };

  const getRemainingAmount = () => {
    const total = parseFloat(totalAmount) || 0;
    return total - calculateTotalShares();
  };

  const pickImageFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permission');
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
    Alert.alert('Add Receipt', 'Choose how you want to add your receipt', [
      { text: 'Take Photo', onPress: captureImageWithCamera },
      { text: 'Choose from Library', onPress: pickImageFromLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleCreateEvent = async () => {
    if (!eventName.trim()) {
      Alert.alert('Missing information', 'Please enter an event name');
      return;
    }

    const amount = parseFloat(totalAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount');
      return;
    }

    if (splitType === 'specified') {
      if (!receiptImage) {
        Alert.alert('Missing receipt', 'Please upload a receipt image');
        return;
      }
      const share = parseFloat(myShare);
      if (isNaN(share) || share <= 0 || share > amount) {
        Alert.alert('Invalid share', 'Please enter a valid share amount for yourself');
        return;
      }
    }

    if (!user) return;

    setLoading(true);

    try {
      if (selectedFriends.length === 0) {
        Alert.alert('Error', 'Please select at least one friend to split with');
        setLoading(false);
        return;
      }

      const participantCount = selectedFriends.length + 1;
      let creatorAmount = 0;

      if (splitType === 'equal') {
        const equalShare = amount / participantCount;
        creatorAmount = equalShare;
        
        const participants = [
          { userId: user.id, amount: creatorAmount },
          ...selectedFriends.map(friend => ({
            userId: friend.odooUserId,
            amount: equalShare,
          })),
        ];

        const totalShares = participants.reduce((sum, p) => sum + p.amount, 0);
        if (Math.abs(totalShares - amount) > 0.01) {
          Alert.alert('Error', `Participant shares ($${totalShares.toFixed(2)}) must equal total amount ($${amount.toFixed(2)})`);
          setLoading(false);
          return;
        }

        const result = await SplitsService.createSplit({
          name: eventName.trim(),
          totalAmount: amount,
          splitType,
          creatorId: user.id,
          participants,
          receiptUri: receiptImage,
          receiptBase64,
          receiptMimeType,
          receiptFileName,
        });
        
        if (result.xpResult) {
          checkLevelUp(result.xpResult);
        }
      } else {
        creatorAmount = parseFloat(myShare || '0');
        
        const participants = [
          { userId: user.id, amount: creatorAmount },
          ...selectedFriends.map(friend => ({
            userId: friend.odooUserId,
            amount: 0,
          })),
        ];

        const result = await SplitsService.createSplit({
          name: eventName.trim(),
          totalAmount: amount,
          splitType,
          creatorId: user.id,
          participants,
          receiptUri: receiptImage,
          receiptBase64,
          receiptMimeType,
          receiptFileName,
        });
        
        if (result.xpResult) {
          checkLevelUp(result.xpResult);
        }
      }

      // Reset the navigation stack to show MainHome with the tab bar
      navigation.getParent()?.reset({
        index: 0,
        routes: [{ name: 'HomeTab', params: { screen: 'MainHome' } }],
      });
    } catch (error) {
      console.error('Failed to create split:', error);
      const message = error instanceof Error ? error.message : 'Failed to create split. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const calculatedShare = splitType === 'equal' && totalAmount
    ? (parseFloat(totalAmount) / (selectedFriends.length + 1)).toFixed(2)
    : '0.00';

  return (
    <ScreenKeyboardAwareScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText style={[Typography.h1, { color: theme.text, marginBottom: Spacing.xl }]}>
          Event Details
        </ThemedText>

        <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.sm }]}>
          Event Name
        </ThemedText>
        <TextInput
          style={[styles.input, { 
            backgroundColor: theme.surface, 
            color: theme.text, 
            borderColor: theme.border 
          }]}
          placeholder="e.g., Dinner at Restaurant"
          placeholderTextColor={theme.textSecondary}
          value={eventName}
          onChangeText={setEventName}
        />

        <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.sm, marginTop: Spacing.lg }]}>
          Total Amount
        </ThemedText>
        <TextInput
          style={[styles.input, { 
            backgroundColor: theme.surface, 
            color: theme.text, 
            borderColor: theme.border 
          }]}
          placeholder="0.00"
          placeholderTextColor={theme.textSecondary}
          value={totalAmount}
          onChangeText={setTotalAmount}
          keyboardType="decimal-pad"
        />

        <Pressable
          style={[styles.uploadButton, { 
            backgroundColor: receiptImage ? theme.success + '20' : theme.surface,
            borderColor: theme.border,
            marginTop: Spacing.lg
          }]}
          onPress={showReceiptSourceOptions}
        >
          <Feather 
            name={receiptImage ? 'check-circle' : 'upload'} 
            size={24} 
            color={receiptImage ? theme.success : theme.textSecondary} 
          />
          <ThemedText style={[Typography.body, { color: theme.text, marginLeft: Spacing.md }]}>
            {receiptImage ? 'Receipt added' : 'Add Receipt'}
          </ThemedText>
        </Pressable>

        {receiptImage ? (
          <Image source={{ uri: receiptImage }} style={styles.receiptPreview} resizeMode="contain" />
        ) : null}

        {splitType === 'equal' ? (
          <View style={[styles.infoBox, { backgroundColor: theme.primary + '20', marginTop: Spacing.lg }]}>
            <ThemedText style={[Typography.caption, { color: theme.text }]}>
              Each person pays: ${calculatedShare}
            </ThemedText>
            <ThemedText style={[Typography.small, { color: theme.textSecondary, marginTop: Spacing.xs }]}>
              Receipt is optional for equal splits.
            </ThemedText>
          </View>
        ) : (
          <>
            <ThemedText style={[Typography.h2, { color: theme.text, marginTop: Spacing.xl, marginBottom: Spacing.md }]}>
              Your Share
            </ThemedText>

            <View style={[styles.participantRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.participantInfo}>
                <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
                  You (Creator)
                </ThemedText>
                <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                  Enter the amount you are paying
                </ThemedText>
              </View>
              <View style={styles.amountInputWrapper}>
                <ThemedText style={[Typography.body, { color: theme.text, marginRight: Spacing.xs }]}>$</ThemedText>
                <TextInput
                  style={[styles.amountInput, { 
                    backgroundColor: theme.backgroundSecondary, 
                    color: theme.text, 
                    borderColor: theme.border 
                  }]}
                  placeholder="0.00"
                  placeholderTextColor={theme.textSecondary}
                  value={myShare}
                  onChangeText={setMyShare}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={[styles.infoBox, { backgroundColor: theme.primary + '15', marginTop: Spacing.lg }]}>
              <Feather name="info" size={16} color={theme.primary} style={{ marginBottom: Spacing.xs }} />
              <ThemedText style={[Typography.caption, { color: theme.text }]}>
                Your {selectedFriends.length} invited friend{selectedFriends.length > 1 ? 's' : ''} will enter their own amounts after accepting the invite.
              </ThemedText>
            </View>
          </>
        )}
      </ThemedView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { 
              backgroundColor: theme.primary, 
              opacity: pressed ? 0.7 : (loading ? 0.4 : 1)
            }
          ]}
          onPress={handleCreateEvent}
          disabled={loading}
        >
          <ThemedText style={[Typography.body, { color: Colors.light.buttonText, fontWeight: '600' }]}>
            {loading ? 'Creating...' : 'Create Event'}
          </ThemedText>
        </Pressable>
      </View>
    </ScreenKeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  input: {
    height: Spacing.inputHeight,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
  },
  infoBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
  receiptPreview: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.lg,
    backgroundColor: '#00000010',
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  participantInfo: {
    flex: 1,
  },
  amountInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountInput: {
    width: 100,
    height: 44,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    textAlign: 'right',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  button: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
