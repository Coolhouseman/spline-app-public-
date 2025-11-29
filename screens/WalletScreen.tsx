import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, FlatList, RefreshControl, Modal, TextInput, Alert, ActivityIndicator, Linking, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { Wallet, Transaction } from '@/shared/types';
import { WalletService, BankDetails, DEMO_BANKS } from '@/services/wallet.service';
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
  const [showBlinkPayErrorModal, setShowBlinkPayErrorModal] = useState(false);
  const [showDemoBankModal, setShowDemoBankModal] = useState(false);
  
  const [amount, setAmount] = useState('');
  const [processing, setProcessing] = useState(false);
  
  const isDemo = wallet?.bank_details?.is_demo === true;

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
        'Connect Bank First',
        'You need to connect your bank account to add funds. Would you like to connect now?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Connect Bank',
            onPress: () => {
              setShowAddFundsModal(false);
              setAmount('');
              setShowDemoBankModal(true);
            }
          }
        ]
      );
      return;
    }
    
    setProcessing(true);
    try {
      if (wallet.bank_details?.is_demo) {
        await WalletService.addFundsDemo(user.id, numAmount);
        await loadWalletData();
        setAmount('');
        setShowAddFundsModal(false);
        Alert.alert('Success', `$${numAmount.toFixed(2)} added to your wallet`);
      } else {
        await WalletService.addFundsViaBlinkPay(user.id, numAmount);
        await loadWalletData();
        setAmount('');
        setShowAddFundsModal(false);
        Alert.alert('Success', `$${numAmount.toFixed(2)} added to your wallet via BlinkPay`);
      }
    } catch (error: any) {
      console.error('Add funds error:', error);
      Alert.alert('Error', error.message || 'Failed to add funds');
    } finally {
      setProcessing(false);
    }
  };


  const handleConnectDemoBank = async (bankId: string) => {
    if (!user) return;
    
    setProcessing(true);
    try {
      await WalletService.connectDemoBank(user.id, bankId);
      await loadWalletData();
      setShowDemoBankModal(false);
      Alert.alert('Success', 'Demo bank account connected! You can now add funds and make payments.');
    } catch (error: any) {
      console.error('Connect demo bank error:', error);
      Alert.alert('Error', error.message || 'Failed to connect demo bank');
    } finally {
      setProcessing(false);
    }
  };

  const handleConnectBank = async () => {
    if (!user) return;
    
    setProcessing(true);
    try {
      const redirectUri = 'splitpaymentapp://blinkpay-callback';
      const result = await WalletService.initiateBlinkPayConsent(user.id, redirectUri);
      
      const browserResult = await WebBrowser.openAuthSessionAsync(
        result.redirectUri,
        redirectUri
      );
      
      if (browserResult.type === 'success') {
        await WalletService.completeBlinkPayConsent(user.id);
        await loadWalletData();
        Alert.alert('Success', 'Bank account connected successfully');
      } else if (browserResult.type === 'cancel') {
        Alert.alert('Cancelled', 'Bank connection was cancelled');
      }
    } catch (error: any) {
      console.error('Connect bank error:', error);
      
      if (error.message?.includes('Unexpected token') || error.message?.includes('<!DOCTYPE')) {
        if (Platform.OS === 'web') {
          setShowBlinkPayErrorModal(true);
        } else {
          Alert.alert(
            'BlinkPay Not Available',
            'Bank connection requires running the app locally or on a device via Expo Go. The web preview cannot reach the payment server.\n\nTo test BlinkPay:\n1. Run the project on your local computer\n2. Or scan the QR code with Expo Go on your phone',
            [{ text: 'OK' }]
          );
        }
      } else {
        Alert.alert('Error', error.message || 'Failed to connect bank account');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleDisconnectBank = async () => {
    if (!user) return;
    
    Alert.alert(
      'Disconnect Bank',
      'Are you sure you want to disconnect your bank account? You will need to reconnect to make payments or withdrawals.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            try {
              await WalletService.disconnectBank(user.id);
              await loadWalletData();
              Alert.alert('Success', 'Bank account disconnected');
            } catch (error) {
              console.error('Disconnect bank error:', error);
              Alert.alert('Error', 'Failed to disconnect bank account');
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
          
          {wallet.bank_connected ? (
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

        {wallet.bank_connected && wallet.bank_details ? (
          <View style={styles.bankInfo}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <ThemedText style={[Typography.caption, { color: 'rgba(255,255,255,0.6)' }]}>
                  Bank Connected
                </ThemedText>
                {isDemo ? (
                  <View style={{ backgroundColor: '#F59E0B', paddingHorizontal: Spacing.xs, paddingVertical: 1, borderRadius: 4 }}>
                    <ThemedText style={[Typography.caption, { color: '#FFFFFF', fontSize: 10, fontWeight: '600' }]}>
                      DEMO
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              <ThemedText style={[Typography.small, { color: '#FFFFFF' }]}>
                {wallet.bank_details.bank_name} •••• {wallet.bank_details.account_last4}
              </ThemedText>
            </View>
            <Pressable
              style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              onPress={handleDisconnectBank}
              disabled={processing}
            >
              <ThemedText style={[Typography.small, { color: '#FFFFFF', fontWeight: '600' }]}>
                Disconnect
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.connectBankButton,
              { backgroundColor: 'rgba(255,255,255,0.9)', opacity: pressed ? 0.7 : 1 }
            ]}
            onPress={() => setShowDemoBankModal(true)}
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

      <Modal visible={showBlinkPayErrorModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={{ alignItems: 'center', marginBottom: Spacing.lg }}>
              <Feather name="alert-circle" size={48} color={theme.warning || '#F59E0B'} />
            </View>
            <ThemedText style={[Typography.h2, { color: theme.text, textAlign: 'center', marginBottom: Spacing.md }]}>
              BlinkPay Not Available
            </ThemedText>
            <ThemedText style={[Typography.body, { color: theme.textSecondary, textAlign: 'center', marginBottom: Spacing.lg }]}>
              Bank connection requires running the app locally or on a device via Expo Go. The web preview cannot reach the payment server.
            </ThemedText>
            <ThemedText style={[Typography.small, { color: theme.textSecondary, textAlign: 'center', marginBottom: Spacing.xl }]}>
              To test BlinkPay:{'\n'}
              1. Run the project on your local computer{'\n'}
              2. Or scan the QR code with Expo Go on your phone
            </ThemedText>
            <Pressable
              style={({ pressed }) => [
                styles.modalButton,
                { backgroundColor: theme.primary, opacity: pressed ? 0.7 : 1, flex: 0, width: '100%' }
              ]}
              onPress={() => setShowBlinkPayErrorModal(false)}
            >
              <ThemedText style={[Typography.body, { color: '#FFFFFF', fontWeight: '600' }]}>
                Got It
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showDemoBankModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg }}>
              <View style={{ flex: 1 }}>
                <ThemedText style={[Typography.h2, { color: theme.text }]}>
                  Connect Your Bank
                </ThemedText>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xs }}>
                  <View style={{ backgroundColor: '#F59E0B', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.xs }}>
                    <ThemedText style={[Typography.caption, { color: '#FFFFFF', fontWeight: '600' }]}>
                      DEMO MODE
                    </ThemedText>
                  </View>
                </View>
              </View>
              <Pressable onPress={() => setShowDemoBankModal(false)} disabled={processing}>
                <Feather name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>
            
            <ThemedText style={[Typography.body, { color: theme.textSecondary, marginBottom: Spacing.lg }]}>
              Select your bank to connect. This is a demo mode for testing the payment flow.
            </ThemedText>

            <View style={{ gap: Spacing.sm }}>
              {DEMO_BANKS.map((bank) => (
                <Pressable
                  key={bank.id}
                  style={({ pressed }) => [
                    styles.bankOption,
                    { 
                      backgroundColor: theme.surface, 
                      borderColor: theme.border,
                      opacity: pressed ? 0.7 : 1 
                    }
                  ]}
                  onPress={() => handleConnectDemoBank(bank.id)}
                  disabled={processing}
                >
                  <View style={[styles.bankLogo, { backgroundColor: bank.color }]}>
                    <Feather name="credit-card" size={20} color="#FFFFFF" />
                  </View>
                  <ThemedText style={[Typography.body, { color: theme.text, flex: 1, fontWeight: '500' }]}>
                    {bank.name}
                  </ThemedText>
                  {processing ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <Feather name="chevron-right" size={20} color={theme.textSecondary} />
                  )}
                </Pressable>
              ))}
            </View>
            
            <Pressable
              style={({ pressed }) => [
                styles.modalButton,
                { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.7 : 1, flex: 0, width: '100%', marginTop: Spacing.xl }
              ]}
              onPress={() => setShowDemoBankModal(false)}
              disabled={processing}
            >
              <ThemedText style={[Typography.body, { color: theme.textSecondary }]}>
                Cancel
              </ThemedText>
            </Pressable>
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
  bankOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    gap: Spacing.md,
  },
  bankLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
