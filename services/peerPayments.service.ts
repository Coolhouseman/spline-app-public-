import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { decode } from 'base64-arraybuffer';

import { supabase } from './supabase';
import { WalletService } from './wallet.service';
import { BackendNotificationsService } from './backendNotifications.service';
import { PushNotificationsService } from './pushNotifications.service';
import type { PeerPayment } from '@/shared/types';

interface ReceiptInput {
  receiptUri?: string;
  receiptBase64?: string;
  receiptMimeType?: string;
  receiptFileName?: string;
}

interface RequestPaymentInput extends ReceiptInput {
  requesterId: string;
  payerId: string;
  title: string;
  amount: number;
}

interface PayFriendInput extends ReceiptInput {
  payerId: string;
  recipientId: string;
  title: string;
  amount: number;
}

const mimeTypeFromExtension = (ext: string): string => {
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
    case 'heif':
      return 'image/jpeg';
    default:
      return 'image/jpeg';
  }
};

const extensionFromMimeType = (mimeType?: string): string | undefined => {
  if (!mimeType) return undefined;
  switch (mimeType.toLowerCase()) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
    case 'image/heif':
      return 'jpg';
    default:
      return undefined;
  }
};

const extensionFromPath = (path?: string): string | undefined => {
  if (!path) return undefined;
  const cleanPath = path.split('?')[0].split('#')[0];
  const match = cleanPath.match(/\.([a-zA-Z0-9]+)$/);
  if (!match) return undefined;
  return match[1].toLowerCase();
};

type PeerPaymentRecord = PeerPayment & {
  requester?: {
    id: string;
    name: string;
    email: string;
    profile_picture?: string;
  };
  payer?: {
    id: string;
    name: string;
    email: string;
    profile_picture?: string;
  };
  recipient?: {
    id: string;
    name: string;
    email: string;
    profile_picture?: string;
  };
};

export class PeerPaymentsService {
  private static async uploadReceipt(input: ReceiptInput): Promise<string | undefined> {
    if (!input.receiptUri && !input.receiptBase64) {
      return undefined;
    }

    const fileExt = (
      extensionFromPath(input.receiptFileName) ||
      extensionFromMimeType(input.receiptMimeType) ||
      extensionFromPath(input.receiptUri) ||
      'jpg'
    );
    const filePath = `peer-payments/receipt-${Date.now()}.${fileExt}`;
    const contentType = input.receiptMimeType || mimeTypeFromExtension(fileExt);

    let uploadData: ArrayBuffer | Blob;

    if (input.receiptBase64) {
      uploadData = decode(input.receiptBase64);
    } else if (Platform.OS === 'web') {
      if (!input.receiptUri) throw new Error('Missing receipt image data');
      const response = await fetch(input.receiptUri);
      uploadData = await response.blob();
    } else {
      if (!input.receiptUri) throw new Error('Missing receipt image data');
      const base64 = await FileSystem.readAsStringAsync(input.receiptUri, {
        encoding: 'base64',
      });
      uploadData = decode(base64);
    }

    const { error } = await supabase.storage
      .from('user-uploads')
      .upload(filePath, uploadData, {
        contentType,
        upsert: true,
      });

    if (error) {
      throw new Error('Failed to upload receipt');
    }

    const { data } = supabase.storage.from('user-uploads').getPublicUrl(filePath);
    return data.publicUrl;
  }

  private static async getPeerPaymentOrThrow(userId: string, peerPaymentId: string): Promise<PeerPaymentRecord> {
    const { data, error } = await supabase
      .from('peer_payments')
      .select(`
        *,
        requester:users!peer_payments_requester_id_fkey (
          id,
          name,
          email,
          profile_picture
        ),
        payer:users!peer_payments_payer_id_fkey (
          id,
          name,
          email,
          profile_picture
        ),
        recipient:users!peer_payments_recipient_id_fkey (
          id,
          name,
          email,
          profile_picture
        )
      `)
      .eq('id', peerPaymentId)
      .or(`requester_id.eq.${userId},payer_id.eq.${userId},recipient_id.eq.${userId}`)
      .single();

    if (error || !data) {
      throw new Error('Peer payment not found');
    }

    return data as PeerPaymentRecord;
  }

  static async getPeerPayment(userId: string, peerPaymentId: string): Promise<PeerPaymentRecord> {
    return this.getPeerPaymentOrThrow(userId, peerPaymentId);
  }

  static async requestPayment(input: RequestPaymentInput): Promise<PeerPaymentRecord> {
    const title = input.title.trim();
    if (!title) throw new Error('Please enter a title');
    if (input.amount <= 0) throw new Error('Amount must be greater than zero');

    const receiptUrl = await this.uploadReceipt(input);

    const { data, error } = await supabase
      .from('peer_payments')
      .insert({
        requester_id: input.requesterId,
        payer_id: input.payerId,
        recipient_id: input.requesterId,
        title,
        amount: input.amount,
        direction: 'request_payment',
        status: 'pending',
        receipt_image: receiptUrl ?? null,
      })
      .select(`
        *,
        requester:users!peer_payments_requester_id_fkey (
          id,
          name,
          email,
          profile_picture
        ),
        payer:users!peer_payments_payer_id_fkey (
          id,
          name,
          email,
          profile_picture
        ),
        recipient:users!peer_payments_recipient_id_fkey (
          id,
          name,
          email,
          profile_picture
        )
      `)
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Failed to create payment request');
    }

    const peerPayment = data as PeerPaymentRecord;
    const requesterName = peerPayment.requester?.name || 'Someone';

    await BackendNotificationsService.createNotification({
      user_id: input.payerId,
      type: 'peer_payment_request',
      title: 'Payment Requested',
      message: `${requesterName} requested $${input.amount.toFixed(2)} for ${title}`,
      metadata: {
        peer_payment_id: peerPayment.id,
        requester_id: input.requesterId,
        payer_id: input.payerId,
        recipient_id: input.requesterId,
        title,
        amount: input.amount.toFixed(2),
      },
    });

    await PushNotificationsService.sendPushToUser(input.payerId, {
      title: 'Payment Requested',
      body: `${requesterName} requested $${input.amount.toFixed(2)} for ${title}`,
      data: {
        type: 'peer_payment_request',
        peerPaymentId: peerPayment.id,
      },
    });

    return peerPayment;
  }

  static async payFriend(input: PayFriendInput): Promise<PeerPaymentRecord> {
    const title = input.title.trim();
    if (!title) throw new Error('Please enter a title');
    if (input.amount <= 0) throw new Error('Amount must be greater than zero');

    const receiptUrl = await this.uploadReceipt(input);

    const { data: recipientUser, error: recipientError } = await supabase
      .from('users')
      .select('id, name, email, profile_picture')
      .eq('id', input.recipientId)
      .single();

    if (recipientError || !recipientUser) {
      throw new Error('Friend not found');
    }

    const { data: payerUser } = await supabase
      .from('users')
      .select('id, name, email, profile_picture')
      .eq('id', input.payerId)
      .single();

    const payerName = payerUser?.name || 'Someone';

    await WalletService.payPeerPayment(
      input.payerId,
      null,
      input.amount,
      input.recipientId,
      recipientUser.name || 'your friend',
      title
    );

    let peerPayment: PeerPaymentRecord;
    const { data, error } = await supabase
      .from('peer_payments')
      .insert({
        requester_id: input.payerId,
        payer_id: input.payerId,
        recipient_id: input.recipientId,
        title,
        amount: input.amount,
        direction: 'pay_friend',
        status: 'paid',
        paid_at: new Date().toISOString(),
        receipt_image: receiptUrl ?? null,
      })
      .select(`
        *,
        requester:users!peer_payments_requester_id_fkey (
          id,
          name,
          email,
          profile_picture
        ),
        payer:users!peer_payments_payer_id_fkey (
          id,
          name,
          email,
          profile_picture
        ),
        recipient:users!peer_payments_recipient_id_fkey (
          id,
          name,
          email,
          profile_picture
        )
      `)
      .single();

    if (error || !data) {
      console.error('Payment succeeded but peer payment record could not be saved:', error);
      peerPayment = {
        id: `paid-${Date.now()}`,
        requester_id: input.payerId,
        payer_id: input.payerId,
        recipient_id: input.recipientId,
        title,
        amount: input.amount,
        direction: 'pay_friend',
        status: 'paid',
        paid_at: new Date().toISOString(),
        receipt_image: receiptUrl ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        payer: {
          id: input.payerId,
          name: payerName,
          email: payerUser?.email || '',
          profile_picture: payerUser?.profile_picture,
        },
        recipient: recipientUser,
      };
    } else {
      peerPayment = data as PeerPaymentRecord;
    }

    const finalPayerName = peerPayment.payer?.name || payerName;

    await BackendNotificationsService.createNotification({
      user_id: input.recipientId,
      type: 'peer_payment_received',
      title: 'Peer Payment Received',
      message: `${finalPayerName} paid you $${input.amount.toFixed(2)} for ${title}`,
      metadata: {
        peer_payment_id: peerPayment.id,
        requester_id: input.payerId,
        payer_id: input.payerId,
        recipient_id: input.recipientId,
        title,
        amount: input.amount.toFixed(2),
      },
    });

    await PushNotificationsService.sendPushToUser(input.recipientId, {
      title: 'Peer Payment Received',
      body: `${finalPayerName} paid you $${input.amount.toFixed(2)} for ${title}`,
      data: {
        type: 'peer_payment_received',
        peerPaymentId: peerPayment.id,
      },
    });

    return peerPayment;
  }

  static async payRequest(userId: string, peerPaymentId: string): Promise<PeerPaymentRecord> {
    const current = await this.getPeerPaymentOrThrow(userId, peerPaymentId);

    if (current.payer_id !== userId) {
      throw new Error('Only the requested payer can complete this payment');
    }
    if (current.status !== 'pending') {
      throw new Error('This payment request is no longer pending');
    }

    const { data: claimed, error: claimError } = await supabase
      .from('peer_payments')
      .update({ status: 'processing' })
      .eq('id', peerPaymentId)
      .eq('payer_id', userId)
      .eq('status', 'pending')
      .select(`
        *,
        requester:users!peer_payments_requester_id_fkey (
          id,
          name,
          email,
          profile_picture
        ),
        payer:users!peer_payments_payer_id_fkey (
          id,
          name,
          email,
          profile_picture
        ),
        recipient:users!peer_payments_recipient_id_fkey (
          id,
          name,
          email,
          profile_picture
        )
      `)
      .single();

    if (claimError || !claimed) {
      throw new Error('This payment request is already being processed');
    }

    let paymentProcessed = false;

    try {
      await WalletService.payPeerPayment(
        userId,
        peerPaymentId,
        claimed.amount,
        claimed.recipient_id,
        claimed.recipient?.name || 'your friend',
        claimed.title
      );
      paymentProcessed = true;

      const { error: completeError } = await supabase
        .from('peer_payments')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .eq('id', peerPaymentId)
        .eq('status', 'processing');

      if (completeError) {
        throw new Error('Payment succeeded but failed to finalize the request');
      }

      try {
        await BackendNotificationsService.createNotification({
          user_id: claimed.requester_id,
          type: 'peer_payment_paid',
          title: 'Peer Payment Paid',
          message: `${claimed.payer?.name || 'Someone'} paid your request for ${claimed.title}`,
          metadata: {
            peer_payment_id: peerPaymentId,
            requester_id: claimed.requester_id,
            payer_id: claimed.payer_id,
            recipient_id: claimed.recipient_id,
            title: claimed.title,
            amount: Number(claimed.amount).toFixed(2),
          },
        });

        await PushNotificationsService.sendPushToUser(claimed.requester_id, {
          title: 'Peer Payment Paid',
          body: `${claimed.payer?.name || 'Someone'} paid your request for ${claimed.title}`,
          data: {
            type: 'peer_payment_paid',
            peerPaymentId,
          },
        });
      } catch (notificationError) {
        console.error('Failed to notify requester about paid peer payment:', notificationError);
      }
    } catch (error) {
      if (!paymentProcessed) {
        await supabase
          .from('peer_payments')
          .update({ status: 'pending' })
          .eq('id', peerPaymentId)
          .eq('status', 'processing');
      }
      throw error;
    }

    return this.getPeerPaymentOrThrow(userId, peerPaymentId);
  }

  static async declineRequest(userId: string, peerPaymentId: string): Promise<void> {
    const current = await this.getPeerPaymentOrThrow(userId, peerPaymentId);
    if (current.payer_id !== userId) {
      throw new Error('Only the requested payer can decline this request');
    }
    if (current.status !== 'pending') {
      throw new Error('This payment request is no longer pending');
    }

    const { error } = await supabase
      .from('peer_payments')
      .update({ status: 'declined' })
      .eq('id', peerPaymentId)
      .eq('payer_id', userId)
      .eq('status', 'pending');

    if (error) {
      throw new Error('Failed to decline the request');
    }

    await BackendNotificationsService.createNotification({
      user_id: current.requester_id,
      type: 'peer_payment_declined',
      title: 'Peer Payment Declined',
      message: `${current.payer?.name || 'Someone'} declined your request for ${current.title}`,
      metadata: {
        peer_payment_id: peerPaymentId,
        requester_id: current.requester_id,
        payer_id: current.payer_id,
        recipient_id: current.recipient_id,
        title: current.title,
        amount: Number(current.amount).toFixed(2),
      },
    });

    await PushNotificationsService.sendPushToUser(current.requester_id, {
      title: 'Peer Payment Declined',
      body: `${current.payer?.name || 'Someone'} declined your request for ${current.title}`,
      data: {
        type: 'peer_payment_declined',
        peerPaymentId: peerPaymentId,
      },
    });
  }

  static async cancelRequest(userId: string, peerPaymentId: string): Promise<void> {
    const current = await this.getPeerPaymentOrThrow(userId, peerPaymentId);
    if (current.requester_id !== userId) {
      throw new Error('Only the requester can cancel this request');
    }
    if (current.status !== 'pending') {
      throw new Error('Only pending requests can be cancelled');
    }

    const { error } = await supabase
      .from('peer_payments')
      .update({ status: 'cancelled' })
      .eq('id', peerPaymentId)
      .eq('requester_id', userId)
      .eq('status', 'pending');

    if (error) {
      throw new Error('Failed to cancel the request');
    }

    await BackendNotificationsService.createNotification({
      user_id: current.payer_id,
      type: 'peer_payment_cancelled',
      title: 'Peer Payment Cancelled',
      message: `${current.requester?.name || 'Someone'} cancelled the request for ${current.title}`,
      metadata: {
        peer_payment_id: peerPaymentId,
        requester_id: current.requester_id,
        payer_id: current.payer_id,
        recipient_id: current.recipient_id,
        title: current.title,
        amount: Number(current.amount).toFixed(2),
      },
    });

    await PushNotificationsService.sendPushToUser(current.payer_id, {
      title: 'Peer Payment Cancelled',
      body: `${current.requester?.name || 'Someone'} cancelled the request for ${current.title}`,
      data: {
        type: 'peer_payment_cancelled',
        peerPaymentId: peerPaymentId,
      },
    });
  }
}
