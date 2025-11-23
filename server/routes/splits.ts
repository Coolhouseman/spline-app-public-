import express from 'express';
import { db } from '../storage';
import { splitEvents, splitParticipants, notifications, users } from '../../shared/schema';
import { eq, or, and, sql } from 'drizzle-orm';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = express.Router();

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userSplits = await db.query.splitParticipants.findMany({
      where: eq(splitParticipants.userId, req.userId!),
      with: {
        splitEvent: {
          with: {
            creator: {
              columns: {
                password: false,
              },
            },
            participants: {
              with: {
                user: {
                  columns: {
                    password: false,
                  },
                },
              },
            },
          },
        },
      },
    });

    const splits = userSplits.map((participation) => ({
      ...participation.splitEvent,
      userStatus: participation.status,
      userAmount: participation.amount,
      isCreator: participation.isCreator,
    }));

    res.json(splits);
  } catch (error) {
    console.error('Get splits error:', error);
    res.status(500).json({ error: 'Failed to get splits' });
  }
});

router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const split = await db.query.splitEvents.findFirst({
      where: eq(splitEvents.id, id),
      with: {
        creator: {
          columns: {
            password: false,
          },
        },
        participants: {
          with: {
            user: {
              columns: {
                password: false,
              },
            },
          },
        },
      },
    });

    if (!split) {
      return res.status(404).json({ error: 'Split not found' });
    }

    const userParticipation = split.participants.find(
      (p) => p.userId === req.userId
    );

    if (!userParticipation) {
      return res.status(403).json({ error: 'Not a participant in this split' });
    }

    res.json({
      ...split,
      userStatus: userParticipation.status,
      userAmount: userParticipation.amount,
      isCreator: userParticipation.isCreator,
    });
  } catch (error) {
    console.error('Get split error:', error);
    res.status(500).json({ error: 'Failed to get split' });
  }
});

router.post(
  '/',
  authenticateToken,
  upload.single('receiptImage'),
  async (req: AuthRequest, res) => {
    try {
      const { name, totalAmount, splitType, participantsData } = req.body;

      if (!name || !totalAmount || !splitType || !participantsData) {
        return res.status(400).json({
          error: 'Name, total amount, split type, and participants are required',
        });
      }

      const participants = JSON.parse(participantsData);

      if (!Array.isArray(participants) || participants.length === 0) {
        return res.status(400).json({ error: 'At least one participant is required' });
      }

      const receiptPath = req.file ? `/uploads/${req.file.filename}` : null;

      const [newSplit] = await db
        .insert(splitEvents)
        .values({
          name,
          totalAmount,
          splitType,
          receiptImage: receiptPath,
          creatorId: req.userId!,
        })
        .returning();

      const creatorUser = await db.query.users.findFirst({
        where: eq(users.id, req.userId!),
      });

      const participantRecords = participants.map((p: any) => ({
        splitEventId: newSplit.id,
        userId: p.userId,
        amount: p.amount,
        status: p.userId === req.userId ? 'accepted' : 'pending',
        isCreator: p.userId === req.userId,
      }));

      await db.insert(splitParticipants).values(participantRecords);

      for (const participant of participants) {
        if (participant.userId !== req.userId) {
          await db.insert(notifications).values({
            userId: participant.userId,
            type: 'split_request',
            title: 'New Split Request',
            message: `${creatorUser?.name} invited you to split "${name}"`,
            splitEventId: newSplit.id,
            metadata: {
              splitType,
              amount: participant.amount,
              creatorName: creatorUser?.name,
            },
          });
        }
      }

      res.json(newSplit);
    } catch (error) {
      console.error('Create split error:', error);
      res.status(500).json({ error: 'Failed to create split' });
    }
  }
);

router.put('/:id/respond', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const participation = await db.query.splitParticipants.findFirst({
      where: and(
        eq(splitParticipants.splitEventId, id),
        eq(splitParticipants.userId, req.userId!)
      ),
    });

    if (!participation) {
      return res.status(404).json({ error: 'Participation not found' });
    }

    if (participation.isCreator) {
      return res.status(400).json({ error: 'Creator cannot respond to their own split' });
    }

    const [updated] = await db
      .update(splitParticipants)
      .set({ status })
      .where(
        and(
          eq(splitParticipants.splitEventId, id),
          eq(splitParticipants.userId, req.userId!)
        )
      )
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Respond to split error:', error);
    res.status(500).json({ error: 'Failed to respond to split' });
  }
});

export default router;
