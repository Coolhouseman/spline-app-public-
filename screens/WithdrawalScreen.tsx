import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenKeyboardAwareScrollView } from '@/components/ScreenKeyboardAwareScrollView';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { storageService } from '@/utils/storage';

type Props = NativeStackScreenProps<any, 'Withdrawal'>;

export default function WithdrawalScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const [amount, setAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<'instant' | 'standard' | null>(null);
  const [loading, setLoading] = useState(false);
  const [wallet, setWallet] = useState({ balance: 0, bankConnected: false });

  React.useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    const walletData = await storageService.getWallet();
    setWallet(walletData);
  };

  const handleWithdraw = async () => {
    const withdrawAmount = parseFloat(amount);

    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (withdrawAmount > wallet.balance) {
      Alert.alert('Insufficient Funds', 'You don\'t have enough balance');
      return;
    }

    if (!selectedMethod) {
      Alert.alert('Select Method', 'Please select a withdrawal method');
      return;
    }

    if (!wallet.bankConnected) {
      Alert.alert(
        'Bank Not Connected',
        'Please connect your bank account to withdraw funds',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Connect Bank', onPress: () => handleConnectBank() }
        ]
      );
      return;
    }

    setLoading(true);

    const fee = selectedMethod === 'instant' ? withdrawAmount * 0.02 : 0;
    const totalDeduction = withdrawAmount + fee;

    await storageService.addTransaction({
      id: Date.now().toString(),
      type: 'withdrawal',
      amount: totalDeduction,
      description: `${selectedMethod === 'instant' ? 'Instant' : 'Standard'} withdrawal${fee > 0 ? ` (Fee: $${fee.toFixed(2)})` : ''}`,
      date: new Date().toISOString(),
    });

    setLoading(false);

    Alert.alert(
      'Withdrawal Initiated',
      `$${withdrawAmount.toFixed(2)} will arrive in ${selectedMethod === 'instant' ? 'minutes' : '3-4 days'}`,
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  const handleConnectBank = async () => {
    await storageService.saveWallet({ ...wallet, bankConnected: true });
    setWallet({ ...wallet, bankConnected: true });
    Alert.alert('Bank Connected', 'Your bank account has been connected successfully via Blinkpay');
  };

  return (
    <ScreenKeyboardAwareScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText style={[Typography.h1, { color: theme.text, marginBottom: Spacing.md }]}>
          Withdraw Funds
        </ThemedText>
        <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.xl }]}>
          Available balance: ${wallet.balance.toFixed(2)}
        </ThemedText>

        <TextInput
          style={[styles.input, { 
            backgroundColor: theme.surface, 
            color: theme.text, 
            borderColor: theme.border 
          }]}
          placeholder="Amount to withdraw"
          placeholderTextColor={theme.textSecondary}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          autoFocus
        />

        <ThemedText style={[Typography.h2, { color: theme.text, marginTop: Spacing.xl, marginBottom: Spacing.md }]}>
          Withdrawal Method
        </ThemedText>

        <Pressable
          style={({ pressed }) => [
            styles.methodCard,
            { 
              backgroundColor: theme.surface,
              borderColor: selectedMethod === 'instant' ? theme.primary : theme.border,
              borderWidth: selectedMethod === 'instant' ? 2 : 1,
              opacity: pressed ? 0.7 : 1
            }
          ]}
          onPress={() => setSelectedMethod('instant')}
        >
          <View style={styles.methodHeader}>
            <View style={[styles.iconContainer, { backgroundColor: theme.warning + '20' }]}>
              <Feather name="zap" size={24} color={theme.warning} />
            </View>
            <View style={styles.methodInfo}>
              <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
                Instant
              </ThemedText>
              <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                Arrives in minutes
              </ThemedText>
            </View>
          </View>
          <ThemedText style={[Typography.body, { color: theme.warning, fontWeight: '600' }]}>
            2% fee
          </ThemedText>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.methodCard,
            { 
              backgroundColor: theme.surface,
              borderColor: selectedMethod === 'standard' ? theme.primary : theme.border,
              borderWidth: selectedMethod === 'standard' ? 2 : 1,
              opacity: pressed ? 0.7 : 1
            }
          ]}
          onPress={() => setSelectedMethod('standard')}
        >
          <View style={styles.methodHeader}>
            <View style={[styles.iconContainer, { backgroundColor: theme.success + '20' }]}>
              <Feather name="clock" size={24} color={theme.success} />
            </View>
            <View style={styles.methodInfo}>
              <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
                Standard
              </ThemedText>
              <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                Arrives in 3-4 days
              </ThemedText>
            </View>
          </View>
          <ThemedText style={[Typography.body, { color: theme.success, fontWeight: '600' }]}>
            Free
          </ThemedText>
        </Pressable>

        {!wallet.bankConnected ? (
          <View style={[styles.bankWarning, { backgroundColor: theme.warning + '20', borderColor: theme.warning }]}>
            <Feather name="alert-circle" size={20} color={theme.warning} />
            <ThemedText style={[Typography.caption, { color: theme.text, marginLeft: Spacing.md, flex: 1 }]}>
              You need to connect your bank account via Blinkpay before withdrawing
            </ThemedText>
          </View>
        ) : null}
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
          onPress={handleWithdraw}
          disabled={loading}
        >
          <ThemedText style={[Typography.body, { color: Colors.light.buttonText, fontWeight: '600' }]}>
            {loading ? 'Processing...' : (wallet.bankConnected ? 'Withdraw' : 'Connect Bank & Withdraw')}
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
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  methodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodInfo: {
    marginLeft: Spacing.md,
  },
  bankWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: Spacing.xl,
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
