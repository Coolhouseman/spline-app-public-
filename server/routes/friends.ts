import express from 'express';
import { db } from '../storage';
import { friends, users } from '../../shared/schema';
import { eq, or, and } from 'drizzle-orm';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userFriends = await db.query.friends.findMany({
      where: or(
        eq(friends.userId, req.userId!),
        eq(friends.friendId, req.userId!)
      ),
      with: {
        user: {
          columns: {
            password: false,
          },
        },
        friend: {
          columns: {
            password: false,
          },
        },
      },
    });

    const friendsList = userFriends.map((friendship) => {
      const isSender = friendship.userId === req.userId;
      const friendData = isSender ? friendship.friend : friendship.user;
      return {
        id: friendData.id,
        uniqueId: friendData.uniqueId,
        name: friendData.name,
        email: friendData.email,
        phone: friendData.phone,
        profilePicture: friendData.profilePicture,
        bio: friendData.bio,
      };
    });

    res.json(friendsList);
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Failed to get friends' });
  }
});

router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { friendUniqueId } = req.body;

    if (!friendUniqueId) {
      return res.status(400).json({ error: 'Friend unique ID is required' });
    }

    const friendUser = await db.query.users.findFirst({
      where: eq(users.uniqueId, friendUniqueId),
    });

    if (!friendUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (friendUser.id === req.userId) {
      return res.status(400).json({ error: 'Cannot add yourself as a friend' });
    }

    const existingFriendship = await db.query.friends.findFirst({
      where: or(
        and(
          eq(friends.userId, req.userId!),
          eq(friends.friendId, friendUser.id)
        ),
        and(
          eq(friends.userId, friendUser.id),
          eq(friends.friendId, req.userId!)
        )
      ),
    });

    if (existingFriendship) {
      return res.status(400).json({ error: 'Already friends with this user' });
    }

    const [newFriendship] = await db
      .insert(friends)
      .values({
        userId: req.userId!,
        friendId: friendUser.id,
        status: 'accepted',
      })
      .returning();

    res.json({
      id: friendUser.id,
      uniqueId: friendUser.uniqueId,
      name: friendUser.name,
      email: friendUser.email,
      phone: friendUser.phone,
      profilePicture: friendUser.profilePicture,
      bio: friendUser.bio,
    });
  } catch (error) {
    console.error('Add friend error:', error);
    res.status(500).json({ error: 'Failed to add friend' });
  }
});

router.delete('/:friendId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { friendId } = req.params;

    await db.delete(friends).where(
      or(
        and(eq(friends.userId, req.userId!), eq(friends.friendId, friendId)),
        and(eq(friends.userId, friendId), eq(friends.friendId, req.userId!))
      )
    );

    res.json({ message: 'Friend removed successfully' });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

export default router;
