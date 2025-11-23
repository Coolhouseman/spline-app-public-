import { supabase } from './supabase';
import type { SplitEvent, SplitParticipant, Notification } from '@/shared/types';

export interface CreateSplitData {
  name: string;
  totalAmount: number;
  splitType: 'equal' | 'specified';
  creatorId: string;
  participants: { userId: string; amount: number }[];
  receiptUri?: string;
}

export class SplitsService {
  static async createSplit(data: CreateSplitData): Promise<SplitEvent> {
    let receiptUrl: string | undefined;

    if (data.receiptUri) {
      const response = await fetch(data.receiptUri);
      const blob = await response.blob();
      const fileExt = data.receiptUri.split('.').pop();
      const fileName = `receipt-${Date.now()}.${fileExt}`;
      const filePath = `receipts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('user-uploads')
        .upload(filePath, blob, {
          contentType: `image/${fileExt}`,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(filePath);

      receiptUrl = publicUrl;
    }

    const { data: split, error: splitError } = await supabase
      .from('split_events')
      .insert({
        name: data.name,
        total_amount: data.totalAmount,
        split_type: data.splitType,
        receipt_image: receiptUrl,
        creator_id: data.creatorId,
      })
      .select()
      .single();

    if (splitError) throw splitError;

    const participantsToInsert = data.participants.map(p => ({
      split_event_id: split.id,
      user_id: p.userId,
      amount: p.amount,
      status: p.userId === data.creatorId ? 'accepted' : 'pending',
      is_creator: p.userId === data.creatorId,
    }));

    const { error: participantsError } = await supabase
      .from('split_participants')
      .insert(participantsToInsert);

    if (participantsError) throw participantsError;

    const { data: creator } = await supabase
      .from('users')
      .select('name')
      .eq('id', data.creatorId)
      .single();

    const notificationsToCreate = data.participants
      .filter(p => p.userId !== data.creatorId)
      .map(p => ({
        user_id: p.userId,
        type: 'split_invite',
        title: 'New Split Request',
        message: `${creator?.name || 'Someone'} wants to split ${data.name}`,
        split_event_id: split.id,
        metadata: {
          split_type: data.splitType,
          amount: p.amount.toString(),
          creator_name: creator?.name,
        },
        read: false,
      }));

    if (notificationsToCreate.length > 0) {
      await supabase.from('notifications').insert(notificationsToCreate);
    }

    return split as SplitEvent;
  }

  static async getSplits(userId: string): Promise<SplitEvent[]> {
    const { data, error } = await supabase
      .from('split_participants')
      .select(`
        split_event_id,
        split_events (
          *,
          creator:creator_id (
            id,
            name,
            profile_picture
          ),
          participants:split_participants (
            *,
            user:user_id (
              id,
              name,
              profile_picture
            )
          )
        )
      `)
      .eq('user_id', userId);

    if (error) throw error;

    const splits = data
      .map(item => item.split_events)
      .filter(Boolean)
      .flat() as unknown as SplitEvent[];

    return splits;
  }

  static async getSplitDetails(splitId: string): Promise<SplitEvent> {
    const { data, error } = await supabase
      .from('split_events')
      .select(`
        *,
        creator:creator_id (
          id,
          name,
          profile_picture
        ),
        participants:split_participants (
          *,
          user:user_id (
            id,
            name,
            profile_picture
          )
        )
      `)
      .eq('id', splitId)
      .single();

    if (error) throw error;
    return data as SplitEvent;
  }

  static async respondToSplit(
    userId: string,
    splitId: string,
    response: 'accepted' | 'declined'
  ): Promise<void> {
    const { data: participant, error: fetchError } = await supabase
      .from('split_participants')
      .select('*, split_events(creator_id, name)')
      .eq('split_event_id', splitId)
      .eq('user_id', userId)
      .single();

    if (fetchError) throw fetchError;
    if (participant.is_creator) throw new Error('Creator cannot respond to their own split');

    const { error: updateError } = await supabase
      .from('split_participants')
      .update({ status: response })
      .eq('split_event_id', splitId)
      .eq('user_id', userId);

    if (updateError) throw updateError;

    const { data: user } = await supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .single();

    const creatorId = (participant as any).split_events.creator_id;
    const splitName = (participant as any).split_events.name;

    await supabase.from('notifications').insert({
      user_id: creatorId,
      type: response === 'accepted' ? 'split_accepted' : 'split_declined',
      title: response === 'accepted' ? 'Split Accepted' : 'Split Declined',
      message: `${user?.name || 'Someone'} ${response} your split for ${splitName}`,
      split_event_id: splitId,
      read: false,
    });
  }

  static async paySplit(userId: string, splitId: string): Promise<void> {
    const { data: participant, error: fetchError } = await supabase
      .from('split_participants')
      .select('amount, split_events(creator_id, name)')
      .eq('split_event_id', splitId)
      .eq('user_id', userId)
      .single();

    if (fetchError) throw fetchError;

    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (walletError) throw walletError;
    if (wallet.balance < participant.amount) {
      throw new Error('Insufficient balance');
    }

    const { error: participantError } = await supabase
      .from('split_participants')
      .update({ status: 'paid' })
      .eq('split_event_id', splitId)
      .eq('user_id', userId);

    if (participantError) throw participantError;

    const creatorId = (participant as any).split_events.creator_id;

    await supabase.rpc('process_split_payment', {
      payer_id: userId,
      recipient_id: creatorId,
      amount: participant.amount,
    });

    await supabase.from('transactions').insert([
      {
        user_id: userId,
        type: 'split_payment',
        amount: participant.amount,
        description: `Payment for ${(participant as any).split_events.name}`,
        direction: 'out',
        split_event_id: splitId,
      },
      {
        user_id: creatorId,
        type: 'split_received',
        amount: participant.amount,
        description: `Received from ${(participant as any).split_events.name}`,
        direction: 'in',
        split_event_id: splitId,
      },
    ]);

    const { data: user } = await supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .single();

    await supabase.from('notifications').insert({
      user_id: creatorId,
      type: 'split_paid',
      title: 'Payment Received',
      message: `${user?.name || 'Someone'} paid their share for ${(participant as any).split_events.name}`,
      split_event_id: splitId,
      read: false,
    });
  }
}
