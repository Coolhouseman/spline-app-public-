import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ScreenKeyboardAwareScrollView } from '@/components/ScreenKeyboardAwareScrollView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';
import { WalletService } from '@/services/wallet.service';
import { Wallet } from '@/shared/types';

type Props = NativeStackScreenProps<any, 'Withdrawal'>;

export default function WithdrawalScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<'fast' | 'normal' | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [wallet, setWallet] = useState<Wallet | null>(null);

  useEffect(() => {
    loadWallet();
  }, [user]);

  const loadWallet = async () => {
    if (!user) {
      setLoadingWallet(false);
      return;
    }
    try {
      const walletData = await WalletService.getWallet(user.id);
      setWallet(walletData);
    } catch (error) {
      console.error('Failed to load wallet:', error);
    } finally {
      setLoadingWallet(false);
    }
  };

  const calculateFee = () => {
    const withdrawAmount = parseFloat(amount) || 0;
    if (selectedMethod === 'fast') {
      return withdrawAmount * 0.02;
    }
    return 0;
  };

  const calculateTotal = () => {
    const withdrawAmount = parseFloat(amount) || 0;
    return withdrawAmount;
  };

  const calculateReceived = () => {
    const withdrawAmount = parseFloat(amount) || 0;
    if (selectedMethod === 'fast') {
      return withdrawAmount - calculateFee();
    }
    return withdrawAmount;
  };

  const getMaxWithdrawable = () => {
    if (!wallet) return 0;
    return wallet.balance;
  };

  const handleWithdraw = async () => {
    if (!user) return;
    
    const withdrawAmount = parseFloat(amount);

    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (!selectedMethod) {
      Alert.alert('Select Method', 'Please select a withdrawal method');
      return;
    }

    if (!wallet?.bank_connected) {
      Alert.alert(
        'Bank Not Connected',
        'Please connect your bank account to withdraw funds. Go to Wallet to connect your bank.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go to Wallet', onPress: () => navigation.goBack() }
        ]
      );
      return;
    }

    const totalDeduction = calculateTotal();
    if (totalDeduction > wallet.balance) {
      const maxAmount = getMaxWithdrawable();
      Alert.alert('Insufficient Funds', `You can withdraw up to $${maxAmount.toFixed(2)}`);
      return;
    }

    const fee = calculateFee();
    const received = calculateReceived();
    const arrivalText = selectedMethod === 'fast' ? 'within a few hours' : 'in 3-5 business days';

    Alert.alert(
      'Confirm Withdrawal',
      `Withdrawing $${withdrawAmount.toFixed(2)} from wallet${fee > 0 ? `\n\nFast transfer fee: $${fee.toFixed(2)}\nYou will receive: $${received.toFixed(2)}` : ''}\n\nFunds will arrive ${arrivalText}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setLoading(true);
            try {
              await WalletService.withdrawWithType(user.id, withdrawAmount, selectedMethod);
              
              Alert.alert(
                'Withdrawal Initiated',
                `$${received.toFixed(2)} will arrive in your bank ${arrivalText}`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
            } catch (error: any) {
              console.error('Withdrawal error:', error);
              Alert.alert('Withdrawal Failed', error.message || 'Unable to process withdrawal. Please try again.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  if (loadingWallet) {
    return (
      <ThemedView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  return (
    <ScreenKeyboardAwareScrollView contentContainerStyle={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText style={[Typography.h1, { color: theme.text, marginBottom: Spacing.md }]}>
          Withdraw Funds
        </ThemedText>
        <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.xl }]}>
          Available balance: ${wallet?.balance.toFixed(2) || '0.00'}
        </ThemedText>

        <View style={styles.inputWrapper}>
          <ThemedText style={[Typography.h2, { color: theme.text, marginRight: Spacing.xs }]}>$</ThemedText>
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.surface, 
              color: theme.text, 
              borderColor: theme.border 
            }]}
            placeholder="0.00"
            placeholderTextColor={theme.textSecondary}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            autoFocus
          />
        </View>

        <ThemedText style={[Typography.h2, { color: theme.text, marginTop: Spacing.xl, marginBottom: Spacing.md }]}>
          Transfer Speed
        </ThemedText>

        <Pressable
          style={({ pressed }) => [
            styles.methodCard,
            { 
              backgroundColor: theme.surface,
              borderColor: selectedMethod === 'fast' ? theme.warning : theme.border,
              borderWidth: selectedMethod === 'fast' ? 2 : 1,
              opacity: pressed ? 0.7 : 1
            }
          ]}
          onPress={() => setSelectedMethod('fast')}
        >
          <View style={styles.methodHeader}>
            <View style={[styles.iconContainer, { backgroundColor: theme.warning + '20' }]}>
              <Feather name="zap" size={24} color={theme.warning} />
            </View>
            <View style={styles.methodInfo}>
              <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
                Fast Transfer
              </ThemedText>
              <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                Arrives in minutes to hours
              </ThemedText>
            </View>
          </View>
          <View style={styles.feeContainer}>
            <ThemedText style={[Typography.body, { color: theme.warning, fontWeight: '600' }]}>
              2% fee
            </ThemedText>
            {selectedMethod === 'fast' && parseFloat(amount) > 0 ? (
              <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                ${calculateFee().toFixed(2)}
              </ThemedText>
            ) : null}
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.methodCard,
            { 
              backgroundColor: theme.surface,
              borderColor: selectedMethod === 'normal' ? theme.success : theme.border,
              borderWidth: selectedMethod === 'normal' ? 2 : 1,
              opacity: pressed ? 0.7 : 1
            }
          ]}
          onPress={() => setSelectedMethod('normal')}
        >
          <View style={styles.methodHeader}>
            <View style={[styles.iconContainer, { backgroundColor: theme.success + '20' }]}>
              <Feather name="clock" size={24} color={theme.success} />
            </View>
            <View style={styles.methodInfo}>
              <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
                Normal Transfer
              </ThemedText>
              <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                Arrives in 3-5 business days
              </ThemedText>
            </View>
          </View>
          <ThemedText style={[Typography.body, { color: theme.success, fontWeight: '600' }]}>
            Free
          </ThemedText>
        </Pressable>

        {selectedMethod && parseFloat(amount) > 0 ? (
          <View style={[styles.summaryCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
            <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600', marginBottom: Spacing.sm }]}>
              Summary
            </ThemedText>
            <View style={styles.summaryRow}>
              <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
                Withdrawal amount
              </ThemedText>
              <ThemedText style={[Typography.body, { color: theme.text }]}>
                ${parseFloat(amount).toFixed(2)}
              </ThemedText>
            </View>
            {selectedMethod === 'fast' ? (
              <View style={styles.summaryRow}>
                <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
                  Fast transfer fee (2%)
                </ThemedText>
                <ThemedText style={[Typography.body, { color: theme.warning }]}>
                  -${calculateFee().toFixed(2)}
                </ThemedText>
              </View>
            ) : null}
            <View style={[styles.summaryRow, styles.summaryTotal]}>
              <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
                You will receive (approx)
              </ThemedText>
              <ThemedText style={[Typography.body, { color: theme.success, fontWeight: '600' }]}>
                ${calculateReceived().toFixed(2)}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
                Estimated arrival
              </ThemedText>
              <ThemedText style={[Typography.caption, { color: theme.primary }]}>
                {selectedMethod === 'fast' ? 'Within hours' : '3-5 business days'}
              </ThemedText>
            </View>
          </View>
        ) : null}

        {!wallet?.bank_connected ? (
          <View style={[styles.bankWarning, { backgroundColor: theme.warning + '20', borderColor: theme.warning }]}>
            <Feather name="alert-circle" size={20} color={theme.warning} />
            <ThemedText style={[Typography.caption, { color: theme.text, marginLeft: Spacing.md, flex: 1 }]}>
              Connect your bank account in Wallet to enable withdrawals
            </ThemedText>
          </View>
        ) : null}

        <View style={[styles.infoBox, { backgroundColor: theme.primary + '10', marginTop: Spacing.lg }]}>
          <Feather name="shield" size={16} color={theme.primary} style={{ marginRight: Spacing.sm }} />
          <ThemedText style={[Typography.small, { color: theme.textSecondary, flex: 1 }]}>
            For security, recently deposited funds have a 24-hour hold before withdrawal. Earned funds from split payments can be withdrawn immediately.
          </ThemedText>
        </View>
      </ThemedView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { 
              backgroundColor: wallet?.bank_connected ? theme.primary : theme.textSecondary,
              opacity: pressed ? 0.7 : (loading || !selectedMethod || !parseFloat(amount) ? 0.5 : 1)
            }
          ]}
          onPress={handleWithdraw}
          disabled={loading || !wallet?.bank_connected || !selectedMethod || !parseFloat(amount)}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <ThemedText style={[Typography.body, { color: Colors.light.buttonText, fontWeight: '600' }]}>
              {wallet?.bank_connected ? 'Withdraw' : 'Connect Bank First'}
            </ThemedText>
          )}
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
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: Spacing.inputHeight,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.lg,
    fontSize: 24,
    fontWeight: '600',
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
    flex: 1,
  },
  feeContainer: {
    alignItems: 'flex-end',
  },
  summaryCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: Spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  summaryTotal: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  bankWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: Spacing.xl,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
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
