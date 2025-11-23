import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  USER: '@split_user',
  FRIENDS: '@split_friends',
  EVENTS: '@split_events',
  WALLET: '@split_wallet',
  NOTIFICATIONS: '@split_notifications',
};

export interface User {
  id: string;
  uniqueId: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  dateOfBirth: string;
  profilePicture?: string;
  bio: string;
}

export interface Friend {
  uniqueId: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
}

export interface Participant {
  uniqueId: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
  status: 'pending' | 'paid' | 'declined';
  amount: number;
}

export interface SplitEvent {
  id: string;
  name: string;
  initiatorId: string;
  initiatorName: string;
  initiatorPicture?: string;
  totalAmount: number;
  myShare: number;
  splitType: 'equal' | 'specified';
  receiptImage?: string;
  participants: Participant[];
  createdAt: string;
  status: 'in_progress' | 'completed';
}

export interface WalletTransaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out' | 'payment';
  amount: number;
  description: string;
  date: string;
  eventId?: string;
}

export interface Wallet {
  balance: number;
  transactions: WalletTransaction[];
  bankConnected: boolean;
}

export interface Notification {
  id: string;
  eventId: string;
  eventName: string;
  initiatorName: string;
  amount: number;
  type: 'split_invite';
  timestamp: string;
}

export const storageService = {
  async saveUser(user: User): Promise<void> {
    await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
  },

  async getUser(): Promise<User | null> {
    const data = await AsyncStorage.getItem(KEYS.USER);
    return data ? JSON.parse(data) : null;
  },

  async clearUser(): Promise<void> {
    await AsyncStorage.removeItem(KEYS.USER);
  },

  async saveFriends(friends: Friend[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.FRIENDS, JSON.stringify(friends));
  },

  async getFriends(): Promise<Friend[]> {
    const data = await AsyncStorage.getItem(KEYS.FRIENDS);
    return data ? JSON.parse(data) : [];
  },

  async addFriend(friend: Friend): Promise<void> {
    const friends = await this.getFriends();
    friends.push(friend);
    await this.saveFriends(friends);
  },

  async saveEvents(events: SplitEvent[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.EVENTS, JSON.stringify(events));
  },

  async getEvents(): Promise<SplitEvent[]> {
    const data = await AsyncStorage.getItem(KEYS.EVENTS);
    return data ? JSON.parse(data) : [];
  },

  async addEvent(event: SplitEvent): Promise<void> {
    const events = await this.getEvents();
    events.push(event);
    await this.saveEvents(events);
  },

  async updateEvent(eventId: string, updates: Partial<SplitEvent>): Promise<void> {
    const events = await this.getEvents();
    const index = events.findIndex(e => e.id === eventId);
    if (index !== -1) {
      events[index] = { ...events[index], ...updates };
      await this.saveEvents(events);
    }
  },

  async saveWallet(wallet: Wallet): Promise<void> {
    await AsyncStorage.setItem(KEYS.WALLET, JSON.stringify(wallet));
  },

  async getWallet(): Promise<Wallet> {
    const data = await AsyncStorage.getItem(KEYS.WALLET);
    return data ? JSON.parse(data) : { balance: 0, transactions: [], bankConnected: false };
  },

  async addTransaction(transaction: WalletTransaction): Promise<void> {
    const wallet = await this.getWallet();
    wallet.transactions.unshift(transaction);
    
    if (transaction.type === 'deposit' || transaction.type === 'transfer_in' || transaction.type === 'payment') {
      wallet.balance += transaction.amount;
    } else {
      wallet.balance -= transaction.amount;
    }
    
    await this.saveWallet(wallet);
  },

  async saveNotifications(notifications: Notification[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  },

  async getNotifications(): Promise<Notification[]> {
    const data = await AsyncStorage.getItem(KEYS.NOTIFICATIONS);
    return data ? JSON.parse(data) : [];
  },

  async addNotification(notification: Notification): Promise<void> {
    const notifications = await this.getNotifications();
    notifications.unshift(notification);
    await this.saveNotifications(notifications);
  },

  async removeNotification(notificationId: string): Promise<void> {
    const notifications = await this.getNotifications();
    const filtered = notifications.filter(n => n.id !== notificationId);
    await this.saveNotifications(filtered);
  },

  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([
      KEYS.USER,
      KEYS.FRIENDS,
      KEYS.EVENTS,
      KEYS.WALLET,
      KEYS.NOTIFICATIONS,
    ]);
  },
};

export function generateUniqueId(): string {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

export function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}
