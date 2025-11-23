import { supabase } from './supabase';
import type { Friend, User } from '@/shared/types';

export class FriendsService {
  static async addFriend(userId: string, friendUniqueId: string): Promise<Friend> {
    const { data: friendUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('unique_id', friendUniqueId)
      .single();

    if (userError || !friendUser) throw new Error('User not found with this ID');
    if (friendUser.id === userId) throw new Error('Cannot add yourself as a friend');

    const { data: existing } = await supabase
      .from('friends')
      .select('id')
      .or(`and(user_id.eq.${userId},friend_id.eq.${friendUser.id}),and(user_id.eq.${friendUser.id},friend_id.eq.${userId})`)
      .single();

    if (existing) throw new Error('Already friends with this user');

    const { data, error } = await supabase
      .from('friends')
      .insert({
        user_id: userId,
        friend_id: friendUser.id,
        status: 'accepted',
      })
      .select()
      .single();

    if (error) throw error;

    await supabase
      .from('friends')
      .insert({
        user_id: friendUser.id,
        friend_id: userId,
        status: 'accepted',
      });

    return data as Friend;
  }

  static async getFriends(userId: string): Promise<Friend[]> {
    const { data, error } = await supabase
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

    if (error) throw error;
    return data as Friend[];
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
