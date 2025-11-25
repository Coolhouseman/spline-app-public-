import { supabase } from './supabase';
import type { SplitEvent, SplitParticipant, Notification } from '@/shared/types';
import { PushNotificationsService } from './pushNotifications.service';

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

      const inviteeIds = data.participants
        .filter(p => p.userId !== data.creatorId)
        .map(p => p.userId);
      
      for (const userId of inviteeIds) {
        const participant = data.participants.find(p => p.userId === userId);
        await PushNotificationsService.sendPushToUser(userId, {
          title: 'New Split Request',
          body: `${creator?.name || 'Someone'} invited you to split $${participant?.amount.toFixed(2)} for ${data.name}`,
          data: {
            type: 'split_invite',
            splitEventId: split.id,
          },
        });
      }
    }

    return split as SplitEvent;
  }

  static async getSplits(userId: string): Promise<SplitEvent[]> {
    const { data: participantIds, error: participantError } = await supabase
      .from('split_participants')
      .select('split_event_id')
      .eq('user_id', userId);

    if (participantError) throw participantError;
    if (!participantIds || participantIds.length === 0) return [];

    const splitIds = participantIds.map(p => p.split_event_id);

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
      .in('id', splitIds);

    if (error) throw error;

    return data as SplitEvent[];
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

    const { error: participantError } = await supabase
      .from('split_participants')
      .update({ status: 'paid' })
      .eq('split_event_id', splitId)
      .eq('user_id', userId);

    if (participantError) throw participantError;

    const creatorId = (participant as any).split_events.creator_id;
    const splitName = (participant as any).split_events.name;

    const { data: user } = await supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .single();

    await supabase.from('notifications').insert({
      user_id: creatorId,
      type: 'split_paid',
      title: 'Payment Received',
      message: `${user?.name || 'Someone'} paid their share for ${splitName}`,
      split_event_id: splitId,
      read: false,
    });

    await PushNotificationsService.sendPushToUser(creatorId, {
      title: 'Payment Received',
      body: `${user?.name || 'Someone'} paid $${participant.amount.toFixed(2)} for ${splitName}`,
      data: {
        type: 'split_paid',
        splitEventId: splitId,
      },
    });

    await this.checkAndNotifySplitCompletion(splitId);
  }

  static async checkAndNotifySplitCompletion(splitId: string): Promise<void> {
    try {
      const { data: participants, error } = await supabase
        .from('split_participants')
        .select('user_id, status, is_creator, split_events(creator_id, name, total_amount)')
        .eq('split_event_id', splitId);

      if (error || !participants || participants.length === 0) return;

      const nonCreatorParticipants = participants.filter(p => !p.is_creator);
      const allPaid = nonCreatorParticipants.every(p => p.status === 'paid');

      if (allPaid && nonCreatorParticipants.length > 0) {
        const creatorId = (participants[0] as any).split_events.creator_id;
        const splitName = (participants[0] as any).split_events.name;
        const totalAmount = (participants[0] as any).split_events.total_amount;

        const { data: existingNotification } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', creatorId)
          .eq('split_event_id', splitId)
          .eq('type', 'split_completed')
          .single();

        if (!existingNotification) {
          await supabase.from('notifications').insert({
            user_id: creatorId,
            type: 'split_completed',
            title: 'Split Complete!',
            message: `Everyone has paid for ${splitName}. You collected $${parseFloat(totalAmount).toFixed(2)}!`,
            split_event_id: splitId,
            read: false,
          });

          await PushNotificationsService.sendPushToUser(creatorId, {
            title: 'Split Complete!',
            body: `Everyone has paid for ${splitName}. You collected $${parseFloat(totalAmount).toFixed(2)}!`,
            data: {
              type: 'split_completed',
              splitEventId: splitId,
            },
          });
        }
      }
    } catch (error) {
      console.error('Error checking split completion:', error);
    }
  }
}
