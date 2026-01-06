import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenKeyboardAwareScrollView } from '@/components/ScreenKeyboardAwareScrollView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { FriendsService } from '@/services/friends.service';

type Props = NativeStackScreenProps<any, 'AddFriend'>;

export default function AddFriendScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [uniqueId, setUniqueId] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAddFriend = async () => {
    setErrorMessage(null);
    
    if (!user?.id) {
      setErrorMessage('Please log in to add friends');
      Alert.alert('Error', 'Please log in to add friends');
      return;
    }

    if (uniqueId.length < 5 || uniqueId.length > 10) {
      setErrorMessage('Unique ID must be between 5-10 digits');
      Alert.alert('Invalid ID', 'Unique ID must be between 5-10 digits');
      return;
    }

    if (uniqueId === user?.unique_id) {
      setErrorMessage('You cannot add yourself as a friend');
      Alert.alert('Invalid ID', 'You cannot add yourself as a friend');
      return;
    }

    setLoading(true);

    try {
      await FriendsService.addFriend(user.id, uniqueId);
      setLoading(false);

      Alert.alert(
        'Request Sent!',
        'Friend request has been sent. They will appear in your friends list once they accept.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      setLoading(false);
      const message = error?.message || 'Failed to send friend request';
      console.error('Add friend error:', message);
      setErrorMessage(message);
      Alert.alert('Error', message);
    }
  };

  const isValidId = /^\d{5,10}$/.test(uniqueId);

  return (
    <ScreenKeyboardAwareScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText style={[Typography.h1, { color: theme.text, marginBottom: Spacing.md }]}>
          Add Friend
        </ThemedText>
        <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.xl }]}>
          Enter your friend's unique ID to add them
        </ThemedText>

        <TextInput
          style={[styles.input, { 
            backgroundColor: theme.surface, 
            color: theme.text, 
            borderColor: theme.border 
          }]}
          placeholder="Enter 5-10 digit ID"
          placeholderTextColor={theme.textSecondary}
          value={uniqueId}
          onChangeText={setUniqueId}
          keyboardType="number-pad"
          autoFocus
          maxLength={10}
        />

        <ThemedText style={[Typography.caption, { color: theme.textSecondary, marginTop: Spacing.sm }]}>
          Only numeric IDs between 5-10 digits are valid
        </ThemedText>

        {errorMessage ? (
          <ThemedText style={[Typography.body, { color: theme.danger, marginTop: Spacing.lg, textAlign: 'center' }]}>
            {errorMessage}
          </ThemedText>
        ) : null}
      </ThemedView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { 
              backgroundColor: theme.primary, 
              opacity: pressed ? 0.7 : (!isValidId || loading ? 0.4 : 1)
            }
          ]}
          onPress={handleAddFriend}
          disabled={!isValidId || loading}
        >
          <ThemedText style={[Typography.body, { color: Colors.light.buttonText, fontWeight: '600' }]}>
            {loading ? 'Adding...' : 'Add Friend'}
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
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  input: {
    height: Spacing.inputHeight,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
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
