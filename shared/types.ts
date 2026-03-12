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

export interface PeerPayment {
  id: string;
  requester_id: string;
  payer_id: string;
  recipient_id: string;
  title: string;
  amount: number;
  direction: 'pay_friend' | 'request_payment';
  status: 'pending' | 'processing' | 'paid' | 'declined' | 'cancelled';
  receipt_image?: string | null;
  created_at: string;
  updated_at: string;
  paid_at?: string | null;
  requester?: User;
  payer?: User;
  recipient?: User;
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
    account_number?: string;
    account_holder_name?: string;
    account_last4?: string;
    account_type?: string;
  };
  stripe_customer_id?: string;
  stripe_payment_method_id?: string;
  card_brand?: string;
  card_last4?: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type:
    | 'deposit'
    | 'withdrawal'
    | 'split_payment'
    | 'split_received'
    | 'peer_payment_sent'
    | 'peer_payment_received'
    | 'card_charge';
  amount: number;
  description: string;
  direction: 'in' | 'out';
  split_event_id?: string;
  metadata?: {
    withdrawal_type?: 'fast' | 'normal';
    fee_amount?: number;
    net_amount?: number;
    estimated_arrival?: string;
    status?: 'pending' | 'processing' | 'completed' | 'failed';
    bank_account_number?: string;
    bank_name?: string;
    account_holder_name?: string;
    peer_payment_id?: string;
    counterparty_id?: string;
    counterparty_name?: string;
    title?: string;
  };
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type:
    | 'split_invite'
    | 'split_accepted'
    | 'split_declined'
    | 'split_paid'
    | 'payment_received'
    | 'split_completed'
    | 'split_cancelled'
    | 'friend_request'
    | 'friend_accepted'
    | 'payment_reminder'
    | 'peer_payment_request'
    | 'peer_payment_paid'
    | 'peer_payment_received'
    | 'peer_payment_declined'
    | 'peer_payment_cancelled';
  title: string;
  message: string;
  split_event_id?: string;
  friendship_id?: string;
  metadata?: {
    split_type?: string;
    amount?: string;
    creator_name?: string;
    sender_name?: string;
    peer_payment_id?: string;
    requester_id?: string;
    payer_id?: string;
    recipient_id?: string;
    title?: string;
  };
  read: boolean;
  created_at: string;
}

export interface BlockedUser {
  id: string;
  user_id: string;
  blocked_user_id: string;
  created_at: string;
  blocked_user?: User;
}

export interface UserReport {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  status: 'open' | 'reviewed' | 'resolved' | 'dismissed';
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  reporter?: User;
  reported_user?: User;
}
