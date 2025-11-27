import { supabase } from './supabase';
import { BackendNotificationsService } from './backendNotifications.service';
import { PushNotificationsService } from './pushNotifications.service';
import type { Friend, User } from '@/shared/types';

export class FriendsService {
  static async sendFriendRequest(userId: string, friendUniqueId: string): Promise<Friend> {
    const REMINDER_COOLDOWN_HOURS = 24;
    
    const { data: currentUser } = await supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .single();

    // Direct query to lookup user by unique_id (RLS is disabled on users table)
    console.log('Looking up user with unique_id:', friendUniqueId);
    
    const { data: friendUser, error: userError } = await supabase
      .from('users')
      .select('id, name')
      .eq('unique_id', friendUniqueId)
      .maybeSingle();

    console.log('User lookup result:', { friendUser, userError });

    if (userError) {
      console.error('User lookup error:', userError);
      throw new Error('User not found with this ID');
    }

    if (!friendUser) {
      console.error('User not found, friendUser is null/undefined');
      throw new Error('User not found with this ID');
    }

    if (friendUser.id === userId) throw new Error('Cannot add yourself as a friend');

    const { data: existing } = await supabase
      .from('friends')
      .select('id, status, user_id, friend_id, last_reminder_at, created_at')
      .or(`and(user_id.eq.${userId},friend_id.eq.${friendUser.id}),and(user_id.eq.${friendUser.id},friend_id.eq.${userId})`)
      .single();

    if (existing) {
      if (existing.status === 'accepted') {
        throw new Error('Already friends with this user');
      }
      
      // Check if this is a request FROM the other user TO us
      if (existing.user_id !== userId) {
        if (existing.status === 'pending') {
          throw new Error('This user already sent you a friend request. Check your notifications!');
        }
        // If it's declined or any other status from their side, we can send our own request
        // by updating this record to be from us
        const lastSentAt = existing.last_reminder_at || existing.created_at;
        const hoursSinceLastSent = (Date.now() - new Date(lastSentAt).getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceLastSent < REMINDER_COOLDOWN_HOURS) {
          const hoursRemaining = Math.ceil(REMINDER_COOLDOWN_HOURS - hoursSinceLastSent);
          throw new Error(`Please wait ${hoursRemaining} hour${hoursRemaining > 1 ? 's' : ''} before sending a friend request`);
        }
        
        // Update the existing record to be from us
        await supabase
          .from('friends')
          .update({ 
            user_id: userId,
            friend_id: friendUser.id,
            status: 'pending',
            last_reminder_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        
        // Create notification via backend API (non-blocking)
        try {
          const notifResult = await BackendNotificationsService.createNotification({
            user_id: friendUser.id,
            type: 'friend_request',
            title: 'Friend Request',
            message: `${currentUser?.name || 'Someone'} wants to be your friend`,
            friendship_id: existing.id,
            metadata: {
              sender_id: userId,
              sender_name: currentUser?.name,
              friendship_id: existing.id,
            },
          });
          if (!notifResult.success) {
            console.warn('Notification creation failed (non-blocking):', notifResult.error);
          }
        } catch (notifError) {
          console.warn('Notification creation error (non-blocking):', notifError);
        }
        
        // Push notification (non-blocking)
        PushNotificationsService.sendPushToUser(friendUser.id, {
          title: 'Friend Request',
          body: `${currentUser?.name || 'Someone'} wants to be your friend`,
          data: {
            type: 'friend_request',
            senderId: userId,
          },
        }).catch(e => console.warn('Push notification failed (non-blocking):', e));
        
        return { ...existing, user_id: userId, friend_id: friendUser.id, status: 'pending' } as Friend;
      }
      
      // This is OUR request to them - handle pending/declined/any status
      const lastSentAt = existing.last_reminder_at || existing.created_at;
      const hoursSinceLastSent = (Date.now() - new Date(lastSentAt).getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastSent < REMINDER_COOLDOWN_HOURS) {
        const hoursRemaining = Math.ceil(REMINDER_COOLDOWN_HOURS - hoursSinceLastSent);
        throw new Error(`Please wait ${hoursRemaining} hour${hoursRemaining > 1 ? 's' : ''} before sending another reminder`);
      }
      
      // Update the existing record (reactivate if declined, or just update reminder time if pending)
      await supabase
        .from('friends')
        .update({ 
          status: 'pending',
          last_reminder_at: new Date().toISOString() 
        })
        .eq('id', existing.id);
      
      const isReminder = existing.status === 'pending';
      // Create notification via backend API
      const notifResult = await BackendNotificationsService.createNotification({
        user_id: friendUser.id,
        type: 'friend_request',
        title: isReminder ? 'Friend Request Reminder' : 'Friend Request',
        message: isReminder 
          ? `${currentUser?.name || 'Someone'} is waiting for your response`
          : `${currentUser?.name || 'Someone'} wants to be your friend`,
        friendship_id: existing.id,
        metadata: {
          sender_id: userId,
          sender_name: currentUser?.name,
          friendship_id: existing.id,
          is_reminder: isReminder,
        },
      });
      
      if (!notifResult.success) {
        console.error('Failed to create notification:', notifResult.error);
      }

      // Push notification (non-blocking)
      PushNotificationsService.sendPushToUser(friendUser.id, {
        title: isReminder ? 'Friend Request Reminder' : 'Friend Request',
        body: isReminder 
          ? `${currentUser?.name || 'Someone'} is waiting for your response`
          : `${currentUser?.name || 'Someone'} wants to be your friend`,
        data: {
          type: 'friend_request',
          senderId: userId,
        },
      }).catch(e => console.warn('Push notification failed (non-blocking):', e));

      return { ...existing, status: 'pending' } as Friend;
    }

    const { data, error } = await supabase
      .from('friends')
      .insert({
        user_id: userId,
        friend_id: friendUser.id,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    console.log('Creating notification for user:', friendUser.id, 'with friendship_id:', data.id);
    
    // Create notification via backend API
    const notifResult = await BackendNotificationsService.createNotification({
      user_id: friendUser.id,
      type: 'friend_request',
      title: 'Friend Request',
      message: `${currentUser?.name || 'Someone'} wants to be your friend`,
      friendship_id: data.id,
      metadata: {
        sender_id: userId,
        sender_name: currentUser?.name,
        friendship_id: data.id,
      },
    });

    if (!notifResult.success) {
      console.error('Failed to create friend request notification:', notifResult.error);
    } else {
      console.log('Notification created successfully:', notifResult.notification?.id);
    }

    // Push notification (non-blocking)
    PushNotificationsService.sendPushToUser(friendUser.id, {
      title: 'Friend Request',
      body: `${currentUser?.name || 'Someone'} wants to be your friend`,
      data: {
        type: 'friend_request',
        senderId: userId,
      },
    }).catch(e => console.warn('Push notification failed (non-blocking):', e));

    return data as Friend;
  }

  static async addFriend(userId: string, friendUniqueId: string): Promise<Friend> {
    return this.sendFriendRequest(userId, friendUniqueId);
  }

  static async getPendingRequests(userId: string): Promise<Friend[]> {
    const { data, error } = await supabase
      .from('friends')
      .select(`
        *,
        requester:user_id (
          id,
          unique_id,
          name,
          email,
          profile_picture,
          bio
        )
      `)
      .eq('friend_id', userId)
      .eq('status', 'pending');

    if (error) throw error;
    return data as Friend[];
  }

  static async getSentPendingRequests(userId: string): Promise<Friend[]> {
    const { data, error } = await supabase
      .from('friends')
      .select(`
        *,
        recipient:friend_id (
          id,
          unique_id,
          name,
          email,
          profile_picture,
          bio
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (error) throw error;
    return data as Friend[];
  }

  static async acceptFriendRequest(userId: string, friendshipId: string): Promise<void> {
    console.log('acceptFriendRequest called with:', { userId, friendshipId });
    
    // First, try to find the record without the friend_id filter to debug
    const { data: anyRecord, error: debugError } = await supabase
      .from('friends')
      .select('id, user_id, friend_id, status')
      .eq('id', friendshipId)
      .maybeSingle();
    
    console.log('Debug - Record lookup by id only:', { anyRecord, debugError });
    
    const { data: friendship, error: fetchError } = await supabase
      .from('friends')
      .select('user_id, friend_id')
      .eq('id', friendshipId)
      .eq('friend_id', userId)
      .eq('status', 'pending')
      .single();

    console.log('Full query result:', { friendship, fetchError });

    if (fetchError || !friendship) {
      console.error('Friend request not found. Expected friend_id:', userId, 'Actual record:', anyRecord);
      throw new Error('Friend request not found');
    }

    await supabase
      .from('friends')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);

    const { data: existing } = await supabase
      .from('friends')
      .select('id')
      .eq('user_id', userId)
      .eq('friend_id', friendship.user_id)
      .single();

    if (!existing) {
      await supabase
        .from('friends')
        .insert({
          user_id: userId,
          friend_id: friendship.user_id,
          status: 'accepted',
        });
    } else {
      await supabase
        .from('friends')
        .update({ status: 'accepted' })
        .eq('id', existing.id);
    }

    const { data: currentUser } = await supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .single();

    // Create notification via backend API
    await BackendNotificationsService.createNotification({
      user_id: friendship.user_id,
      type: 'friend_accepted',
      title: 'Friend Request Accepted',
      message: `${currentUser?.name || 'Someone'} accepted your friend request`,
    });

    await PushNotificationsService.sendPushToUser(friendship.user_id, {
      title: 'Friend Request Accepted',
      body: `${currentUser?.name || 'Someone'} accepted your friend request`,
      data: {
        type: 'friend_accepted',
      },
    });
  }

  static async declineFriendRequest(userId: string, friendshipId: string): Promise<void> {
    // Mark as declined instead of deleting, so we can track cooldown for resends
    const { error } = await supabase
      .from('friends')
      .update({ 
        status: 'declined',
        last_reminder_at: new Date().toISOString() // Reset the cooldown timer
      })
      .eq('id', friendshipId)
      .eq('friend_id', userId)
      .eq('status', 'pending');

    if (error) throw error;
  }

  static async checkFriendship(userId: string, otherUserId: string): Promise<boolean> {
    const { data } = await supabase
      .from('friends')
      .select('id')
      .eq('user_id', userId)
      .eq('friend_id', otherUserId)
      .eq('status', 'accepted')
      .single();

    return !!data;
  }

  static async sendFriendRequestById(userId: string, targetUserId: string): Promise<Friend> {
    const { data: targetUser } = await supabase
      .from('users')
      .select('unique_id')
      .eq('id', targetUserId)
      .single();

    if (!targetUser) throw new Error('User not found');
    
    return this.sendFriendRequest(userId, targetUser.unique_id);
  }

  static async getFriends(userId: string): Promise<Friend[]> {
    const { data: outgoing, error: outError } = await supabase
      .from('friends')
      .select(`
        *,
        friend_details:friend_id (
          id,
          unique_id,
          name,
          email,
          profile_picture,
          bio
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'accepted');

    if (outError) throw outError;

    const { data: incoming, error: inError } = await supabase
      .from('friends')
      .select(`
        *,
        friend_details:user_id (
          id,
          unique_id,
          name,
          email,
          profile_picture,
          bio
        )
      `)
      .eq('friend_id', userId)
      .eq('status', 'accepted');

    if (inError) throw inError;

    const incomingMapped = (incoming || []).map((item: any) => ({
      ...item,
      friend_id: item.user_id,
      user_id: userId,
    }));

    const allFriends = [...(outgoing || []), ...incomingMapped];
    
    const uniqueFriends = allFriends.reduce((acc: any[], friend: any) => {
      const friendId = friend.friend_details?.id || friend.friend_id;
      if (!acc.find((f: any) => (f.friend_details?.id || f.friend_id) === friendId)) {
        acc.push(friend);
      }
      return acc;
    }, []);

    return uniqueFriends as Friend[];
  }

  static async removeFriend(userId: string, friendshipId: string): Promise<void> {
    const { data: friendship, error: fetchError } = await supabase
      .from('friends')
      .select('friend_id')
      .eq('id', friendshipId)
      .eq('user_id', userId)
      .single();

    if (fetchError) throw fetchError;

    await supabase
      .from('friends')
      .delete()
      .eq('id', friendshipId);

    await supabase
      .from('friends')
      .delete()
      .eq('user_id', friendship.friend_id)
      .eq('friend_id', userId);
  }
}
