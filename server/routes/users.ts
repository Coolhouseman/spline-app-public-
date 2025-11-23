import express from 'express';
import { db } from '../storage';
import { users } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = express.Router();

router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.userId!),
      columns: {
        password: false,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

router.put('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { name, phone, dateOfBirth, bio } = req.body;

    const [updatedUser] = await db
      .update(users)
      .set({
        name: name || undefined,
        phone: phone || undefined,
        dateOfBirth: dateOfBirth || undefined,
        bio: bio || undefined,
      })
      .where(eq(users.id, req.userId!))
      .returning();

    res.json({
      id: updatedUser.id,
      uniqueId: updatedUser.uniqueId,
      name: updatedUser.name,
      email: updatedUser.email,
      phone: updatedUser.phone,
      dateOfBirth: updatedUser.dateOfBirth,
      bio: updatedUser.bio,
      profilePicture: updatedUser.profilePicture,
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.post(
  '/me/profile-picture',
  authenticateToken,
  upload.single('profilePicture'),
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const profilePicturePath = `/uploads/${req.file.filename}`;

      const [updatedUser] = await db
        .update(users)
        .set({ profilePicture: profilePicturePath })
        .where(eq(users.id, req.userId!))
        .returning();

      res.json({
        profilePicture: updatedUser.profilePicture,
      });
    } catch (error) {
      console.error('Upload profile picture error:', error);
      res.status(500).json({ error: 'Failed to upload profile picture' });
    }
  }
);

router.get('/by-unique-id/:uniqueId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { uniqueId } = req.params;

    const user = await db.query.users.findFirst({
      where: eq(users.uniqueId, uniqueId),
      columns: {
        password: false,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Find user error:', error);
    res.status(500).json({ error: 'Failed to find user' });
  }
});

export default router;
