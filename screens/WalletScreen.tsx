import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, FlatList, RefreshControl, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { Wallet, Transaction } from '@/shared/types';
import { WalletService, BankDetails } from '@/services/wallet.service';
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
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  
  const [bankName, setBankName] = useState('');
  const [accountLast4, setAccountLast4] = useState('');
  const [accountType, setAccountType] = useState('Checking');

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
        bank_details: null,
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
    
    setProcessing(true);
    try {
      await WalletService.addFunds(user.id, numAmount);
      await loadWalletData();
      setAmount('');
      setShowAddFundsModal(false);
      Alert.alert('Success', `$${numAmount.toFixed(2)} added to your wallet`);
    } catch (error) {
      console.error('Add funds error:', error);
      Alert.alert('Error', 'Failed to add funds');
    } finally {
      setProcessing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!user || !amount) return;
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }
    
    setProcessing(true);
    try {
      await WalletService.withdraw(user.id, numAmount);
      await loadWalletData();
      setAmount('');
      setShowWithdrawModal(false);
      Alert.alert('Success', `$${numAmount.toFixed(2)} withdrawn from your wallet`);
    } catch (error: any) {
      console.error('Withdraw error:', error);
      Alert.alert('Error', error.message || 'Failed to withdraw funds');
    } finally {
      setProcessing(false);
    }
  };

  const handleConnectBank = () => {
    setBankName('');
    setAccountLast4('');
    setAccountType('Checking');
    setIsEditMode(false);
    setShowBankModal(true);
  };

  const handleEditBank = () => {
    if (wallet?.bank_details) {
      setBankName(wallet.bank_details.bank_name || '');
      setAccountLast4(wallet.bank_details.account_last4 || '');
      setAccountType(wallet.bank_details.account_type || 'Checking');
    }
    setIsEditMode(true);
    setShowBankModal(true);
  };

  const handleSaveBank = async () => {
    if (!user || !bankName || !accountLast4) {
      Alert.alert('Missing Information', 'Please fill in all fields');
      return;
    }
    
    if (accountLast4.length !== 4 || !/^\d+$/.test(accountLast4)) {
      Alert.alert('Invalid Account Number', 'Last 4 digits must be 4 numbers');
      return;
    }
    
    setProcessing(true);
    try {
      const bankDetails: BankDetails = {
        bank_name: bankName,
        account_last4: accountLast4,
        account_type: accountType,
      };
      
      if (isEditMode) {
        await WalletService.updateBank(user.id, bankDetails);
      } else {
        await WalletService.connectBank(user.id, bankDetails);
      }
      
      await loadWalletData();
      setShowBankModal(false);
      Alert.alert('Success', isEditMode ? 'Bank details updated' : 'Bank account connected');
    } catch (error) {
      console.error('Bank save error:', error);
      Alert.alert('Error', 'Failed to save bank details');
    } finally {
      setProcessing(false);
    }
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

    return (
      <View style={[styles.transactionCard, { borderBottomColor: theme.border }]}>
        <View style={[styles.transactionIcon, { backgroundColor: `${color}20` }]}>
          <Feather name={getTransactionIcon(item.type)} size={20} color={color} />
        </View>
        <View style={styles.transactionInfo}>
          <ThemedText style={[Typography.body, { color: theme.text, fontWeight: '600' }]}>
            {item.description}
          </ThemedText>
          <ThemedText style={[Typography.caption, { color: theme.textSecondary }]}>
            {new Date(item.created_at).toLocaleDateString()}
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
          
          {wallet.bank_connected ? (
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                { backgroundColor: 'rgba(255,255,255,0.2)', opacity: pressed ? 0.7 : 1 }
              ]}
              onPress={() => setShowWithdrawModal(true)}
            >
              <Feather name="arrow-up-circle" size={20} color="#FFFFFF" />
              <ThemedText style={[Typography.body, { color: '#FFFFFF', marginLeft: Spacing.sm }]}>
                Withdraw
              </ThemedText>
            </Pressable>
          ) : null}
        </View>

        {wallet.bank_connected && wallet.bank_details ? (
          <View style={styles.bankInfo}>
            <View style={{ flex: 1 }}>
              <ThemedText style={[Typography.caption, { color: 'rgba(255,255,255,0.6)' }]}>
                Bank Connected
              </ThemedText>
              <ThemedText style={[Typography.small, { color: '#FFFFFF' }]}>
                {wallet.bank_details.bank_name} •••• {wallet.bank_details.account_last4}
              </ThemedText>
            </View>
            <Pressable
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              onPress={handleEditBank}
            >
              <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '600' }]}>
                Edit
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.connectBankButton,
              { backgroundColor: 'rgba(255,255,255,0.9)', opacity: pressed ? 0.7 : 1 }
            ]}
            onPress={handleConnectBank}
          >
            <Feather name="link" size={18} color={theme.primary} />
            <ThemedText style={[Typography.body, { color: theme.primary, marginLeft: Spacing.sm, fontWeight: '600' }]}>
              Connect Bank Account
            </ThemedText>
          </Pressable>
        )}
      </View>

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

      <Modal visible={showWithdrawModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <ThemedText style={[Typography.h2, { color: theme.text, marginBottom: Spacing.lg }]}>
              Withdraw Funds
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
                onPress={() => { setAmount(''); setShowWithdrawModal(false); }}
                disabled={processing}
              >
                <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
                  Cancel
                </ThemedText>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  { backgroundColor: theme.danger, opacity: pressed ? 0.7 : 1 }
                ]}
                onPress={handleWithdraw}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                    Withdraw
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showBankModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <ThemedText style={[Typography.h2, { color: theme.text, marginBottom: Spacing.lg }]}>
              {isEditMode ? 'Edit' : 'Connect'} Bank Account
            </ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
              value={bankName}
              onChangeText={setBankName}
              placeholder="Bank Name"
              placeholderTextColor={theme.textSecondary}
              editable={!processing}
            />
            <TextInput
              style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, marginTop: Spacing.md }]}
              value={accountLast4}
              onChangeText={setAccountLast4}
              placeholder="Last 4 digits of account"
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              maxLength={4}
              editable={!processing}
            />
            <View style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, marginTop: Spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
              <ThemedText style={[Typography.body, { color: theme.text }]}>Account Type:</ThemedText>
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                <Pressable
                  style={({ pressed }) => [
                    styles.accountTypeButton,
                    { backgroundColor: accountType === 'Checking' ? theme.primary : theme.surface, borderColor: theme.border, opacity: pressed ? 0.7 : 1 }
                  ]}
                  onPress={() => setAccountType('Checking')}
                  disabled={processing}
                >
                  <ThemedText style={[Typography.small, { color: accountType === 'Checking' ? '#FFFFFF' : theme.text }]}>
                    Checking
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.accountTypeButton,
                    { backgroundColor: accountType === 'Savings' ? theme.primary : theme.surface, borderColor: theme.border, opacity: pressed ? 0.7 : 1 }
                  ]}
                  onPress={() => setAccountType('Savings')}
                  disabled={processing}
                >
                  <ThemedText style={[Typography.small, { color: accountType === 'Savings' ? '#FFFFFF' : theme.text }]}>
                    Savings
                  </ThemedText>
                </Pressable>
              </View>
            </View>
            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.7 : 1 }
                ]}
                onPress={() => setShowBankModal(false)}
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
                onPress={handleSaveBank}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                    Save
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
