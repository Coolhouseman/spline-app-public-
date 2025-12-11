import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { BackendNotificationsService } from './backendNotifications.service';
import { PushNotificationsService } from './pushNotifications.service';
import type { Friend, User, BlockedUser } from '@/shared/types';

const getBackendUrl = (): string => {
  const extra = Constants.expoConfig?.extra || {};
  return extra.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8082';
};

const isBackendAccessible = (): boolean => {
  return Platform.OS === 'web';
};

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
      .maybeSingle();

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

    console.log('Inserting new friend request:', { user_id: userId, friend_id: friendUser.id, status: 'pending' });
    
    const { data, error } = await supabase
      .from('friends')
      .insert({
        user_id: userId,
        friend_id: friendUser.id,
        status: 'pending',
      })
      .select()
      .single();

    console.log('Insert result - data:', data, 'error:', error);
    
    if (error) {
      console.error('Failed to insert friend request:', error);
      throw error;
    }
    
    if (!data) {
      console.error('Insert returned no data (possible RLS issue)');
      throw new Error('Failed to create friend request - please try again');
    }

    console.log('Friend request created successfully with ID:', data.id);
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
    
    // If no record found by ID, the friendship record doesn't exist
    if (!anyRecord) {
      console.error('No friends record found with id:', friendshipId);
      throw new Error(`Friend request not found (no record with id: ${friendshipId?.substring(0, 8)}...)`);
    }
    
    // Check if the current user is the recipient (friend_id)
    if (anyRecord.friend_id !== userId) {
      console.error('User mismatch. Record friend_id:', anyRecord.friend_id, 'Current user:', userId);
      throw new Error(`Friend request not found (you are not the recipient)`);
    }
    
    // Check if status is pending
    if (anyRecord.status !== 'pending') {
      console.error('Status is not pending:', anyRecord.status);
      throw new Error(`Friend request already ${anyRecord.status}`);
    }
    
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

  static async getBlockedUsers(userId: string): Promise<BlockedUser[]> {
    if (isBackendAccessible()) {
      try {
        const backendUrl = getBackendUrl();
        const response = await fetch(`${backendUrl}/api/friends/blocked?userId=${userId}`);
        
        if (response.ok) {
          const data = await response.json();
          return data.blockedUsers || [];
        }
      } catch (error) {
        console.warn('Backend blocked users fetch failed, using Supabase fallback');
      }
    }
    
    // First get blocked user IDs
    const { data: blockedData, error: blockedError } = await supabase
      .from('blocked_users')
      .select('id, user_id, blocked_user_id, created_at')
      .eq('user_id', userId);
    
    if (blockedError) {
      console.error('Failed to get blocked users:', blockedError);
      return [];
    }
    
    if (!blockedData || blockedData.length === 0) {
      return [];
    }
    
    // Then fetch user details separately
    const blockedUserIds = blockedData.map(b => b.blocked_user_id);
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, unique_id, name, email, profile_picture')
      .in('id', blockedUserIds);
    
    if (usersError) {
      console.error('Failed to get blocked user details:', usersError);
      return [];
    }
    
    // Combine the data
    const usersMap = new Map(usersData?.map(u => [u.id, u]) || []);
    return blockedData.map(b => ({
      ...b,
      blocked_user: usersMap.get(b.blocked_user_id) || null
    })) as BlockedUser[];
  }

  static async blockUser(userId: string, blockedUserId: string): Promise<void> {
    if (isBackendAccessible()) {
      try {
        const backendUrl = getBackendUrl();
        const response = await fetch(`${backendUrl}/api/friends/block`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, blockedUserId }),
        });
        
        if (response.ok) return;
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error) throw new Error(errorData.error);
      } catch (error: any) {
        if (error.message && !error.message.includes('fetch')) {
          throw error;
        }
        console.warn('Backend block failed, using Supabase fallback');
      }
    }
    
    const { data, error } = await supabase.rpc('block_user', {
      p_user_id: userId,
      p_blocked_user_id: blockedUserId,
    });
    
    if (error) throw new Error(error.message || 'Failed to block user');
    if (data && !data.success) throw new Error(data.error || 'Failed to block user');
  }

  static async unblockUser(userId: string, blockedUserId: string): Promise<void> {
    if (isBackendAccessible()) {
      try {
        const backendUrl = getBackendUrl();
        const response = await fetch(`${backendUrl}/api/friends/block/${blockedUserId}?userId=${userId}`, {
          method: 'DELETE',
        });
        
        if (response.ok) return;
      } catch (error) {
        console.warn('Backend unblock failed, using Supabase fallback');
      }
    }
    
    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('user_id', userId)
      .eq('blocked_user_id', blockedUserId);
    
    if (error) throw new Error(error.message || 'Failed to unblock user');
  }

  static async isUserBlocked(userId: string, otherUserId: string): Promise<boolean> {
    if (isBackendAccessible()) {
      try {
        const backendUrl = getBackendUrl();
        const response = await fetch(`${backendUrl}/api/friends/is-blocked?userId=${userId}&otherUserId=${otherUserId}`);
        
        if (response.ok) {
          const data = await response.json();
          return data.isBlocked || false;
        }
      } catch (error) {
        console.warn('Backend is-blocked check failed, using Supabase fallback');
      }
    }
    
    const { data, error } = await supabase.rpc('is_user_blocked', {
      p_user_id: userId,
      p_other_user_id: otherUserId,
    });
    
    if (error) {
      console.error('Failed to check blocked status:', error);
      return false;
    }
    
    return data || false;
  }

  static async reportUser(reporterId: string, reportedUserId: string, reason: string): Promise<void> {
    // Always use backend for reports - works on all platforms including Expo Go
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reporterId, reportedUserId, reason }),
    });
    
    if (response.ok) return;
    
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to submit report');
  }

  // Subscribe to realtime updates for friend requests and status changes
  static subscribeToFriendUpdates(
    userId: string,
    onUpdate: () => void
  ): { unsubscribe: () => void } {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const debouncedUpdate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(onUpdate, 300);
    };

    // Subscribe to friends table changes for this user
    const channel = supabase
      .channel(`friends_updates_${userId}`)
      // Listen for incoming friend requests (where user is the recipient)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friends',
          filter: `friend_id=eq.${userId}`,
        },
        () => debouncedUpdate()
      )
      // Listen for changes to requests the user sent
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friends',
          filter: `user_id=eq.${userId}`,
        },
        () => debouncedUpdate()
      )
      .subscribe();

    return {
      unsubscribe: () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        supabase.removeChannel(channel);
      },
    };
  }
}
