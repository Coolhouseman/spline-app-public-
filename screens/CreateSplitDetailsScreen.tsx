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
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { SplitsService } from '@/services/splits.service';

type Friend = {
  id: string;
  unique_id: string;
  name: string;
  profile_picture: string | null;
};

type Props = NativeStackScreenProps<any, 'CreateSplitDetails'>;

export default function CreateSplitDetailsScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { selectedFriends, splitType } = route.params as { selectedFriends: Friend[]; splitType: 'equal' | 'specified' };

  const [eventName, setEventName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [myShare, setMyShare] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permission');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setReceiptImage(result.assets[0].uri);
    }
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
        Alert.alert('Invalid share', 'Please enter a valid share amount');
        return;
      }
    }

    if (!user) return;

    setLoading(true);

    try {
      const participantCount = selectedFriends.length + 1;
      const shareAmount = splitType === 'equal' 
        ? amount / participantCount 
        : (amount - parseFloat(myShare || '0')) / selectedFriends.length;

      const participants = [
        {
          userId: user.id,
          amount: splitType === 'equal' ? shareAmount : parseFloat(myShare || '0'),
        },
        ...selectedFriends.map(friend => ({
          userId: friend.id,
          amount: shareAmount,
        })),
      ];

      await SplitsService.createSplit({
        name: eventName.trim(),
        totalAmount: amount,
        splitType,
        creatorId: user.id,
        participants,
        receiptUri: receiptImage,
      });

      navigation.navigate('HomeTab', { screen: 'MainHome' });
    } catch (error) {
      console.error('Failed to create split:', error);
      Alert.alert('Error', 'Failed to create split. Please try again.');
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

        {splitType === 'equal' ? (
          <View style={[styles.infoBox, { backgroundColor: theme.primary + '20', marginTop: Spacing.lg }]}>
            <ThemedText style={[Typography.caption, { color: theme.text }]}>
              Each person pays: ${calculatedShare}
            </ThemedText>
          </View>
        ) : (
          <>
            <Pressable
              style={[styles.uploadButton, { 
                backgroundColor: receiptImage ? theme.success + '20' : theme.surface,
                borderColor: theme.border,
                marginTop: Spacing.lg
              }]}
              onPress={pickImage}
            >
              <Feather 
                name={receiptImage ? 'check-circle' : 'upload'} 
                size={24} 
                color={receiptImage ? theme.success : theme.textSecondary} 
              />
              <ThemedText style={[Typography.body, { color: theme.text, marginLeft: Spacing.md }]}>
                {receiptImage ? 'Receipt uploaded' : 'Upload Receipt'}
              </ThemedText>
            </Pressable>

            {receiptImage ? (
              <Image source={{ uri: receiptImage }} style={styles.receiptPreview} />
            ) : null}

            <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.sm, marginTop: Spacing.lg }]}>
              What is your share?
            </ThemedText>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.surface, 
                color: theme.text, 
                borderColor: theme.border 
              }]}
              placeholder="0.00"
              placeholderTextColor={theme.textSecondary}
              value={myShare}
              onChangeText={setMyShare}
              keyboardType="decimal-pad"
            />

            {myShare && totalAmount ? (
              <View style={[styles.infoBox, { backgroundColor: theme.warning + '20', marginTop: Spacing.lg }]}>
                <ThemedText style={[Typography.caption, { color: theme.text }]}>
                  Remaining: ${(parseFloat(totalAmount) - parseFloat(myShare)).toFixed(2)}
                </ThemedText>
              </View>
            ) : null}
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
