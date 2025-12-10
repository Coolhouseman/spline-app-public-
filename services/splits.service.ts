import { supabase } from './supabase';
import { BackendNotificationsService } from './backendNotifications.service';
import type { SplitEvent, SplitParticipant, Notification } from '@/shared/types';
import { PushNotificationsService } from './pushNotifications.service';
import { GamificationService, XPAwardResult } from './gamification.service';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { decode } from 'base64-arraybuffer';

export interface CreateSplitData {
  name: string;
  totalAmount: number;
  splitType: 'equal' | 'specified';
  creatorId: string;
  participants: { userId: string; amount: number }[];
  receiptUri?: string;
}

export interface CreateSplitResult {
  split: SplitEvent;
  xpResult?: XPAwardResult | null;
}

export interface PaySplitResult {
  xpResult?: XPAwardResult | null;
}

const SPLIT_RATE_LIMITS = {
  MAX_SPLITS_PER_HOUR: 5,
  MAX_SPLITS_PER_DAY: 15,
  ONE_HOUR_MS: 60 * 60 * 1000,
  ONE_DAY_MS: 24 * 60 * 60 * 1000,
};

export class SplitsService {
  private static async checkSplitCreationRateLimit(userId: string): Promise<void> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - SPLIT_RATE_LIMITS.ONE_HOUR_MS);
    const oneDayAgo = new Date(now.getTime() - SPLIT_RATE_LIMITS.ONE_DAY_MS);
    
    const { data: recentSplits, error } = await supabase
      .from('split_events')
      .select('id, created_at')
      .eq('creator_id', userId)
      .gte('created_at', oneDayAgo.toISOString());
    
    if (error) {
      console.error('Failed to check split rate limit:', error);
      throw new Error('Unable to verify rate limits. Please try again in a moment.');
    }
    
    const splitsLastHour = (recentSplits || []).filter(
      s => new Date(s.created_at) >= oneHourAgo
    ).length;
    
    const splitsLastDay = (recentSplits || []).length;
    
    if (splitsLastHour >= SPLIT_RATE_LIMITS.MAX_SPLITS_PER_HOUR) {
      throw new Error(`You can only create ${SPLIT_RATE_LIMITS.MAX_SPLITS_PER_HOUR} splits per hour. Please wait before creating another split.`);
    }
    
    if (splitsLastDay >= SPLIT_RATE_LIMITS.MAX_SPLITS_PER_DAY) {
      throw new Error(`You can only create ${SPLIT_RATE_LIMITS.MAX_SPLITS_PER_DAY} splits per day. Please try again tomorrow.`);
    }
  }

  static async createSplit(data: CreateSplitData): Promise<CreateSplitResult> {
    await this.checkSplitCreationRateLimit(data.creatorId);
    
    let receiptUrl: string | undefined;

    if (data.receiptUri) {
      const fileExt = data.receiptUri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `receipt-${Date.now()}.${fileExt}`;
      const filePath = `receipts/${fileName}`;
      const contentType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;

      let uploadData: ArrayBuffer | Blob;

      if (Platform.OS === 'web') {
        const response = await fetch(data.receiptUri);
        uploadData = await response.blob();
      } else {
        const base64 = await FileSystem.readAsStringAsync(data.receiptUri, {
          encoding: 'base64',
        });
        uploadData = decode(base64);
      }

      const { error: uploadError } = await supabase.storage
        .from('user-uploads')
        .upload(filePath, uploadData, {
          contentType,
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
      status: p.userId === data.creatorId ? 'paid' : 'pending',
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
      // Create notifications via backend API
      for (const notif of notificationsToCreate) {
        await BackendNotificationsService.createNotification({
          user_id: notif.user_id,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          split_event_id: notif.split_event_id,
          metadata: notif.metadata,
        });
      }

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

    // Award XP for creating the split
    let xpResult: import('./gamification.service').XPAwardResult | null = null;
    try {
      xpResult = await GamificationService.onSplitCreated(
        data.creatorId,
        split.id,
        data.totalAmount,
        data.participants.length
      );
    } catch (gamificationError) {
      console.error('Gamification error (non-blocking):', gamificationError);
    }

    return { split: split as SplitEvent, xpResult };
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
          unique_id,
          name,
          profile_picture
        ),
        participants:split_participants (
          *,
          user:user_id (
            id,
            unique_id,
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
          unique_id,
          name,
          profile_picture
        ),
        participants:split_participants (
          *,
          user:user_id (
            id,
            unique_id,
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

    // Create notification via backend API
    await BackendNotificationsService.createNotification({
      user_id: creatorId,
      type: response === 'accepted' ? 'split_accepted' : 'split_declined',
      title: response === 'accepted' ? 'Split Accepted' : 'Split Declined',
      message: `${user?.name || 'Someone'} ${response} your split for ${splitName}`,
      split_event_id: splitId,
    });
  }

  static async respondToSplitWithAmount(
    userId: string,
    splitId: string,
    response: 'accepted' | 'declined',
    amount: number
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
      .update({ 
        status: response,
        amount: amount
      })
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

    // Create notification via backend API
    await BackendNotificationsService.createNotification({
      user_id: creatorId,
      type: response === 'accepted' ? 'split_accepted' : 'split_declined',
      title: response === 'accepted' ? 'Split Accepted' : 'Split Declined',
      message: `${user?.name || 'Someone'} ${response} your split for ${splitName}${response === 'accepted' ? ` with $${amount.toFixed(2)}` : ''}`,
      split_event_id: splitId,
    });
  }

  static async updateParticipantAmount(
    userId: string,
    splitId: string,
    amount: number
  ): Promise<void> {
    const { error } = await supabase
      .from('split_participants')
      .update({ amount: amount })
      .eq('split_event_id', splitId)
      .eq('user_id', userId);

    if (error) throw error;
  }

  static async paySplit(userId: string, splitId: string): Promise<PaySplitResult> {
    const { data: participant, error: fetchError } = await supabase
      .from('split_participants')
      .select('amount, split_events(creator_id, name, created_at)')
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
    const splitCreatedAt = new Date((participant as any).split_events.created_at);

    const { data: user } = await supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .single();

    // Award XP for paying the split
    let xpResult: XPAwardResult | null = null;
    try {
      xpResult = await GamificationService.onSplitPaid(
        userId,
        splitId,
        participant.amount,
        splitCreatedAt
      );
    } catch (gamificationError) {
      console.error('Gamification error (non-blocking):', gamificationError);
    }

    // Create notification via backend API
    await BackendNotificationsService.createNotification({
      user_id: creatorId,
      type: 'split_paid',
      title: 'Payment Received',
      message: `${user?.name || 'Someone'} paid their share for ${splitName}`,
      split_event_id: splitId,
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
    
    return { xpResult };
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
          // Award XP for 100% completion
          try {
            const participantIds = participants.map(p => p.user_id);
            await GamificationService.onSplitCompleted(creatorId, splitId, participantIds);
          } catch (gamificationError) {
            console.error('Gamification completion error (non-blocking):', gamificationError);
          }

          // Create notification via backend API
          await BackendNotificationsService.createNotification({
            user_id: creatorId,
            type: 'split_completed',
            title: 'Split Complete!',
            message: `Everyone has paid for ${splitName}. You collected $${parseFloat(totalAmount).toFixed(2)}!`,
            split_event_id: splitId,
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
