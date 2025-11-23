import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, FlatList, RefreshControl } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { storageService, Wallet, WalletTransaction } from '@/utils/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeBottomTabBarHeight } from '@/hooks/useSafeBottomTabBarHeight';

type Props = NativeStackScreenProps<any, 'Wallet'>;

export default function WalletScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useSafeBottomTabBarHeight();
  const [wallet, setWallet] = useState<Wallet>({ balance: 0, transactions: [], bankConnected: false });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadWallet();
    const unsubscribe = navigation.addListener('focus', loadWallet);
    return unsubscribe;
  }, [navigation]);

  const loadWallet = async () => {
    const walletData = await storageService.getWallet();
    setWallet(walletData);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWallet();
    setRefreshing(false);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
      case 'transfer_in':
        return 'arrow-down-circle';
      case 'withdrawal':
      case 'transfer_out':
        return 'arrow-up-circle';
      case 'payment':
        return 'credit-card';
      default:
        return 'dollar-sign';
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'deposit':
      case 'transfer_in':
      case 'payment':
        return theme.success;
      case 'withdrawal':
      case 'transfer_out':
        return theme.danger;
      default:
        return theme.textSecondary;
    }
  };

  const renderTransaction = ({ item }: { item: WalletTransaction }) => {
    const isCredit = item.type === 'deposit' || item.type === 'transfer_in' || item.type === 'payment';
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
            {new Date(item.date).toLocaleDateString()}
          </ThemedText>
        </View>
        <ThemedText style={[Typography.body, { color, fontWeight: '600' }]}>
          {isCredit ? '+' : '-'}${item.amount.toFixed(2)}
        </ThemedText>
      </View>
    );
  };

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
            onPress={() => {}}
          >
            <Feather name="arrow-down-circle" size={20} color="#FFFFFF" />
            <ThemedText style={[Typography.body, { color: '#FFFFFF', marginLeft: Spacing.sm }]}>
              Add Funds
            </ThemedText>
          </Pressable>
        </View>
      </View>

      <ThemedText style={[Typography.h2, { color: theme.text, marginHorizontal: Spacing.xl, marginBottom: Spacing.md }]}>
        Recent Transactions
      </ThemedText>

      <FlatList
        data={wallet.transactions}
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
});
