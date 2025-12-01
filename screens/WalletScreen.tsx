import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, FlatList, RefreshControl, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { Wallet, Transaction } from '@/shared/types';
import { WalletService, BankDetails } from '@/services/wallet.service';
import { StripeService } from '@/services/stripe.service';
import { supabase } from '@/services/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeBottomTabBarHeight } from '@/hooks/useSafeBottomTabBarHeight';

type Props = NativeStackScreenProps<any, 'Wallet'>;

export default function WalletScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useSafeBottomTabBarHeight();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);
  const [pendingSetupData, setPendingSetupData] = useState<{
    customerId: string;
    setupIntentId: string;
  } | null>(null);
  
  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  
  const hasCard = !!wallet?.stripe_payment_method_id;
  const cardBrand = wallet?.card_brand || '';
  const cardLast4 = wallet?.card_last4 || '';

  useEffect(() => {
    loadWalletData();
    const unsubscribe = navigation.addListener('focus', loadWalletData);
    return unsubscribe;
  }, [navigation, user]);

  const loadWalletData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      let walletData;
      try {
        walletData = await WalletService.getWallet(user.id);
      } catch (error: any) {
        if (error.code === 'PGRST116') {
          const { data, error: createError } = await supabase
            .from('wallets')
            .insert({
              user_id: user.id,
              balance: 0,
              bank_connected: false,
            })
            .select()
            .single();
          
          if (createError) throw createError;
          walletData = data as Wallet;
        } else {
          throw error;
        }
      }
      
      const transactionsData = await WalletService.getTransactions(user.id);
      setWallet(walletData);
      setTransactions(transactionsData);
    } catch (error) {
      console.error('Failed to load wallet:', error);
      Alert.alert('Error', 'Failed to load wallet data');
      setWallet({ 
        id: '', 
        user_id: user?.id || '', 
        balance: 0, 
        bank_connected: false,
        created_at: new Date().toISOString(), 
        updated_at: new Date().toISOString() 
      });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWalletData();
    setRefreshing(false);
  };

  const handleAddFunds = async () => {
    if (!user || !amount) return;
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }
    
    if (!wallet?.bank_connected) {
      Alert.alert(
        'Add Card First',
        'You need to add a payment card to add funds. Would you like to add one now?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add Card',
            onPress: () => {
              setShowAddFundsModal(false);
              setAmount('');
              handleAddCard();
            }
          }
        ]
      );
      return;
    }
    
    setProcessing(true);
    try {
      await WalletService.addFundsViaStripe(user.id, numAmount);
      await loadWalletData();
      setAmount('');
      setShowAddFundsModal(false);
      Alert.alert('Success', `$${numAmount.toFixed(2)} added to your wallet`);
    } catch (error: any) {
      console.error('Add funds error:', error);
      Alert.alert('Error', error.message || 'Failed to add funds');
    } finally {
      setProcessing(false);
    }
  };

  const handleAddCard = async () => {
    if (!user) return;
    
    setProcessing(true);
    try {
      const userName = user.name || 'User';
      const { customerId, setupIntentId, cardSetupUrl } = await StripeService.initiateCardSetup(
        user.id,
        user.email,
        userName,
        wallet?.stripe_customer_id
      );
      
      setPendingSetupData({ customerId, setupIntentId });
      
      const browserResult = await WebBrowser.openAuthSessionAsync(
        cardSetupUrl,
        'splitpaymentapp://stripe-callback'
      );
      
      if (browserResult.type === 'success' && browserResult.url) {
        const url = new URL(browserResult.url);
        const success = url.searchParams.get('success') === 'true';
        const paymentMethodId = url.searchParams.get('payment_method_id');
        
        if (success && paymentMethodId) {
          await StripeService.completeCardSetup(
            user.id,
            setupIntentId,
            paymentMethodId,
            customerId
          );
          await loadWalletData();
          Alert.alert('Success', 'Card added successfully! You can now make payments.');
        } else if (url.searchParams.get('cancelled') === 'true') {
          Alert.alert('Cancelled', 'Card setup was cancelled');
        }
      } else if (browserResult.type === 'cancel') {
        Alert.alert('Cancelled', 'Card setup was cancelled');
      }
    } catch (error: any) {
      console.error('Add card error:', error);
      Alert.alert('Error', error.message || 'Failed to add card');
    } finally {
      setProcessing(false);
      setPendingSetupData(null);
    }
  };

  const handleRemoveCard = async () => {
    if (!user) return;
    
    Alert.alert(
      'Remove Card',
      'Are you sure you want to remove your payment card? You will need to add a new card to make payments.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            try {
              await StripeService.removePaymentMethod(user.id);
              await loadWalletData();
              Alert.alert('Success', 'Card removed successfully');
            } catch (error) {
              console.error('Remove card error:', error);
              Alert.alert('Error', 'Failed to remove card');
            } finally {
              setProcessing(false);
            }
          }
        }
      ]
    );
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'arrow-down-circle';
      case 'withdrawal':
        return 'arrow-up-circle';
      case 'split_payment':
        return 'credit-card';
      case 'split_received':
        return 'trending-up';
      default:
        return 'dollar-sign';
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'deposit':
      case 'split_received':
        return theme.success;
      case 'withdrawal':
      case 'split_payment':
        return theme.danger;
      default:
        return theme.textSecondary;
    }
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const isCredit = item.direction === 'in';
    const color = getTransactionColor(item.type);
    const date = new Date(item.created_at);
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const showBankDetails = item.type === 'withdrawal' && item.metadata?.bank_account_number;
    const bankAccountNumber = item.metadata?.bank_account_number || '';
    const bankName = item.metadata?.bank_name || '';
    const withdrawalType = item.metadata?.withdrawal_type;
    const status = item.metadata?.status || 'pending';

    return (
      <View style={[styles.transactionCard, { borderBottomColor: theme.border }]}>
        <View style={[styles.transactionIcon, { backgroundColor: `${color}20` }]}>
          <Feather name={getTransactionIcon(item.type)} size={20} color={color} />
        </View>
        <View style={styles.transactionInfo}>
          <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
            {item.description}
          </ThemedText>
          {showBankDetails ? (
            <View>
              <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                To: {bankName} {bankAccountNumber}
              </ThemedText>
              <ThemedText style={[Typography.caption, { color: status === 'completed' ? theme.success : theme.warning }]}>
                {status.charAt(0).toUpperCase() + status.slice(1)} {withdrawalType === 'fast' ? '(Fast)' : ''}
              </ThemedText>
            </View>
          ) : null}
          <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
            {dateStr} at {timeStr}
          </ThemedText>
        </View>
        <ThemedText style={[Typography.body, { color, fontWeight: '600' }]}>
          {isCredit ? '+' : '-'}${item.amount.toFixed(2)}
        </ThemedText>
      </View>
    );
  };

  if (loading || !wallet) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.xl, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.xl }]}>
      <View style={styles.header}>
        <ThemedText style={[Typography.h1, { color: theme.text }]}>Wallet</ThemedText>
      </View>

      <View style={[styles.balanceCard, { backgroundColor: theme.primary }]}>
        <ThemedText style={[Typography.caption, { color: 'rgba(255,255,255,0.8)', marginBottom: Spacing.sm }]}>
          Available Balance
        </ThemedText>
        <ThemedText style={[Typography.hero, { color: '#FFFFFF', fontSize: 40 }]}>
          ${wallet.balance.toFixed(2)}
        </ThemedText>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: 'rgba(255,255,255,0.2)', opacity: pressed ? 0.7 : 1 }
            ]}
            onPress={() => setShowAddFundsModal(true)}
          >
            <Feather name="arrow-down-circle" size={20} color="#FFFFFF" />
            <ThemedText style={[Typography.body, { color: '#FFFFFF', marginLeft: Spacing.sm }]}>
              Add Funds
            </ThemedText>
          </Pressable>
          
          {wallet.balance > 0 ? (
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                { backgroundColor: 'rgba(255,255,255,0.2)', opacity: pressed ? 0.7 : 1 }
              ]}
              onPress={() => navigation.navigate('Withdrawal')}
            >
              <Feather name="arrow-up-circle" size={20} color="#FFFFFF" />
              <ThemedText style={[Typography.body, { color: '#FFFFFF', marginLeft: Spacing.sm }]}>
                Withdraw
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        {hasCard ? (
          <View style={styles.bankInfo}>
            <View style={{ flex: 1 }}>
              <ThemedText style={[Typography.caption, { color: 'rgba(255,255,255,0.6)' }]}>
                Payment Card
              </ThemedText>
              <ThemedText style={[Typography.small, { color: '#FFFFFF' }]}>
                {cardBrand.charAt(0).toUpperCase() + cardBrand.slice(1)} •••• {cardLast4}
              </ThemedText>
            </View>
            <Pressable
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              onPress={handleRemoveCard}
              disabled={processing}
            >
              <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '600' }]}>
                Remove
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.connectBankButton,
              { backgroundColor: 'rgba(255,255,255,0.9)', opacity: pressed ? 0.7 : 1 }
            ]}
            onPress={handleAddCard}
          >
            <Feather name="credit-card" size={18} color={theme.primary} />
            <ThemedText style={[Typography.body, { color: theme.primary, marginLeft: Spacing.sm, fontWeight: '600' }]}>
              Add Payment Card
            </ThemedText>
          </Pressable>
        )}
      </View>

      {wallet.bank_connected ? (
        <View style={[styles.bankAccountSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm }}>
            <Feather name="briefcase" size={18} color={theme.success} />
            <ThemedText style={[Typography.body, { color: theme.text, marginLeft: Spacing.sm, fontWeight: '600' }]}>
              Bank Account for Withdrawals
            </ThemedText>
          </View>
          <ThemedText style={[Typography.body, { color: theme.text }]}>
            {wallet.bank_details?.bank_name}
          </ThemedText>
          <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
            Account ending in {wallet.bank_details?.account_last4}
          </ThemedText>
          <Pressable
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginTop: Spacing.sm }]}
            onPress={() => navigation.navigate('Withdrawal')}
          >
            <ThemedText style={[Typography.small, { color: theme.primary, fontWeight: '600' }]}>
              Update Bank Details
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [
            styles.addBankButton,
            { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.7 : 1 }
          ]}
          onPress={() => navigation.navigate('Withdrawal')}
        >
          <Feather name="briefcase" size={18} color={theme.textSecondary} />
          <View style={{ marginLeft: Spacing.md, flex: 1 }}>
            <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
              Add Bank Account
            </ThemedText>
            <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
              Required for withdrawals
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </Pressable>
      )}

      <ThemedText style={[Typography.h2, { color: theme.text, marginHorizontal: Spacing.xl, marginBottom: Spacing.md }]}>
        Recent Transactions
      </ThemedText>

      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: tabBarHeight + Spacing.xl }
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="credit-card" size={48} color={theme.textSecondary} />
            <ThemedText style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.lg }]}>
              No transactions yet
            </ThemedText>
          </View>
        }
      />

      <Modal visible={showAddFundsModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <ThemedText style={[Typography.h2, { color: theme.text, marginBottom: Spacing.lg }]}>
              Add Funds
            </ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
              value={amount}
              onChangeText={setAmount}
              placeholder="Enter amount"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              editable={!processing}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.7 : 1 }
                ]}
                onPress={() => { setAmount(''); setShowAddFundsModal(false); }}
                disabled={processing}
              >
                <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
                  Cancel
                </ThemedText>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  { backgroundColor: theme.primary, opacity: pressed ? 0.7 : 1 }
                ]}
                onPress={handleAddFunds}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                    Add
                  </ThemedText>
                )}
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
  header: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  balanceCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
    padding: Spacing.xl,
    borderRadius: BorderRadius.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'] * 2,
  },
  bankInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  connectBankButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
    marginTop: Spacing.lg,
  },
  bankAccountSection: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  addBankButton: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: BorderRadius.sm,
    padding: Spacing.xl,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    padding: Spacing.md,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountTypeButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
  },
});
