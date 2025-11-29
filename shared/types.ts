export interface User {
  id: string;
  unique_id: string;
  name: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  bio?: string;
  profile_picture?: string;
  push_token?: string;
  created_at: string;
  updated_at: string;
}

export interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'accepted' | 'pending';
  created_at: string;
  friend_details?: User;
}

export interface SplitEvent {
  id: string;
  name: string;
  total_amount: number;
  split_type: 'equal' | 'specified';
  receipt_image?: string;
  creator_id: string;
  created_at: string;
  updated_at: string;
  creator?: User;
  participants?: SplitParticipant[];
}

export interface SplitParticipant {
  id: string;
  split_event_id: string;
  user_id: string;
  amount: number;
  status: 'pending' | 'accepted' | 'declined' | 'paid';
  is_creator: boolean;
  created_at: string;
  updated_at: string;
  user?: User;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  bank_connected: boolean;
  bank_details?: {
    bank_name?: string;
    account_last4?: string;
    account_type?: string;
    is_demo?: boolean;
  };
  blinkpay_consent_id?: string;
  blinkpay_consent_status?: string;
  blinkpay_consent_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: 'deposit' | 'withdrawal' | 'split_payment' | 'split_received';
  amount: number;
  description: string;
  direction: 'in' | 'out';
  split_event_id?: string;
  metadata?: {
    withdrawal_type?: 'fast' | 'normal';
    fee_amount?: number;
    estimated_arrival?: string;
    status?: 'pending' | 'processing' | 'completed' | 'failed';
  };
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'split_invite' | 'split_accepted' | 'split_declined' | 'split_paid' | 'payment_received' | 'split_completed' | 'friend_request' | 'friend_accepted' | 'payment_reminder';
  title: string;
  message: string;
  split_event_id?: string;
  friendship_id?: string;
  metadata?: {
    split_type?: string;
    amount?: string;
    creator_name?: string;
    sender_name?: string;
  };
  read: boolean;
  created_at: string;
}
