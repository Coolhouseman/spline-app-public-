import { supabase } from './supabase';
import { supabaseAdmin } from './supabaseAdmin';
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

    const { data: friendUser, error: userError } = await supabase
      .from('users')
      .select('id, name')
      .eq('unique_id', friendUniqueId)
      .single();

    if (userError || !friendUser) throw new Error('User not found with this ID');
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
        
        // Create notification for the new request using admin client to bypass RLS
        await supabaseAdmin.from('notifications').insert({
          user_id: friendUser.id,
          type: 'friend_request',
          title: 'Friend Request',
          message: `${currentUser?.name || 'Someone'} wants to be your friend`,
          metadata: {
            sender_id: userId,
            sender_name: currentUser?.name,
            friendship_id: existing.id,
          },
          read: false,
        });
        
        await PushNotificationsService.sendPushToUser(friendUser.id, {
          title: 'Friend Request',
          body: `${currentUser?.name || 'Someone'} wants to be your friend`,
          data: {
            type: 'friend_request',
            senderId: userId,
          },
        });
        
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
      // Use admin client to bypass RLS when creating notifications for other users
      const { error: notifError } = await supabaseAdmin.from('notifications').insert({
        user_id: friendUser.id,
        type: 'friend_request',
        title: isReminder ? 'Friend Request Reminder' : 'Friend Request',
        message: isReminder 
          ? `${currentUser?.name || 'Someone'} is waiting for your response`
          : `${currentUser?.name || 'Someone'} wants to be your friend`,
        metadata: {
          sender_id: userId,
          sender_name: currentUser?.name,
          friendship_id: existing.id,
          is_reminder: isReminder,
        },
        read: false,
      });
      
      if (notifError) {
        console.error('Failed to create notification:', notifError);
      }

      await PushNotificationsService.sendPushToUser(friendUser.id, {
        title: isReminder ? 'Friend Request Reminder' : 'Friend Request',
        body: isReminder 
          ? `${currentUser?.name || 'Someone'} is waiting for your response`
          : `${currentUser?.name || 'Someone'} wants to be your friend`,
        data: {
          type: 'friend_request',
          senderId: userId,
        },
      });

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
    
    // Use admin client to bypass RLS when creating notifications for other users
    const { data: notifData, error: notifError } = await supabaseAdmin.from('notifications').insert({
      user_id: friendUser.id,
      type: 'friend_request',
      title: 'Friend Request',
      message: `${currentUser?.name || 'Someone'} wants to be your friend`,
      metadata: {
        sender_id: userId,
        sender_name: currentUser?.name,
        friendship_id: data.id,
      },
      read: false,
    }).select().single();

    if (notifError) {
      console.error('Failed to create friend request notification:', notifError);
    } else {
      console.log('Notification created successfully:', notifData?.id);
    }

    await PushNotificationsService.sendPushToUser(friendUser.id, {
      title: 'Friend Request',
      body: `${currentUser?.name || 'Someone'} wants to be your friend`,
      data: {
        type: 'friend_request',
        senderId: userId,
      },
    });

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
    const { data: friendship, error: fetchError } = await supabase
      .from('friends')
      .select('user_id, friend_id')
      .eq('id', friendshipId)
      .eq('friend_id', userId)
      .eq('status', 'pending')
      .single();

    if (fetchError || !friendship) throw new Error('Friend request not found');

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

    // Use admin client to bypass RLS when creating notifications for other users
    await supabaseAdmin.from('notifications').insert({
      user_id: friendship.user_id,
      type: 'friend_accepted',
      title: 'Friend Request Accepted',
      message: `${currentUser?.name || 'Someone'} accepted your friend request`,
      read: false,
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
