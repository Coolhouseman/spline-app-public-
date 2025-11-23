import express from 'express';
import { db } from '../storage';
import { wallets, transactions } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const wallet = await db.query.wallets.findFirst({
      where: eq(wallets.userId, req.userId!),
    });

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    res.json(wallet);
  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({ error: 'Failed to get wallet' });
  }
});

router.post('/connect-bank', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { bankName, accountLast4, accountType } = req.body;

    if (!bankName || !accountLast4 || !accountType) {
      return res.status(400).json({
        error: 'Bank name, account last 4 digits, and account type are required',
      });
    }

    const [updatedWallet] = await db
      .update(wallets)
      .set({
        bankConnected: true,
        bankDetails: {
          bankName,
          accountLast4,
          accountType,
        },
      })
      .where(eq(wallets.userId, req.userId!))
      .returning();

    res.json(updatedWallet);
  } catch (error) {
    console.error('Connect bank error:', error);
    res.status(500).json({ error: 'Failed to connect bank' });
  }
});

router.put('/bank', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { bankName, accountLast4, accountType } = req.body;

    const [updatedWallet] = await db
      .update(wallets)
      .set({
        bankDetails: {
          bankName: bankName || undefined,
          accountLast4: accountLast4 || undefined,
          accountType: accountType || undefined,
        },
      })
      .where(eq(wallets.userId, req.userId!))
      .returning();

    res.json(updatedWallet);
  } catch (error) {
    console.error('Update bank error:', error);
    res.status(500).json({ error: 'Failed to update bank details' });
  }
});

router.post('/disconnect-bank', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const [updatedWallet] = await db
      .update(wallets)
      .set({
        bankConnected: false,
        bankDetails: null,
      })
      .where(eq(wallets.userId, req.userId!))
      .returning();

    res.json(updatedWallet);
  } catch (error) {
    console.error('Disconnect bank error:', error);
    res.status(500).json({ error: 'Failed to disconnect bank' });
  }
});

router.post('/add-funds', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { amount } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const wallet = await db.query.wallets.findFirst({
      where: eq(wallets.userId, req.userId!),
    });

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const newBalance = (parseFloat(wallet.balance) + parseFloat(amount)).toFixed(2);

    const [updatedWallet] = await db
      .update(wallets)
      .set({ balance: newBalance })
      .where(eq(wallets.userId, req.userId!))
      .returning();

    await db.insert(transactions).values({
      userId: req.userId!,
      type: 'deposit',
      amount,
      description: 'Added funds to wallet',
      direction: 'credit',
    });

    res.json(updatedWallet);
  } catch (error) {
    console.error('Add funds error:', error);
    res.status(500).json({ error: 'Failed to add funds' });
  }
});

router.post('/withdraw', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { amount } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const wallet = await db.query.wallets.findFirst({
      where: eq(wallets.userId, req.userId!),
    });

    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    if (!wallet.bankConnected) {
      return res.status(400).json({ error: 'Bank account not connected' });
    }

    if (parseFloat(wallet.balance) < parseFloat(amount)) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    const newBalance = (parseFloat(wallet.balance) - parseFloat(amount)).toFixed(2);

    const [updatedWallet] = await db
      .update(wallets)
      .set({ balance: newBalance })
      .where(eq(wallets.userId, req.userId!))
      .returning();

    await db.insert(transactions).values({
      userId: req.userId!,
      type: 'withdrawal',
      amount,
      description: 'Withdrew funds from wallet',
      direction: 'debit',
    });

    res.json(updatedWallet);
  } catch (error) {
    console.error('Withdraw error:', error);
    res.status(500).json({ error: 'Failed to withdraw funds' });
  }
});

router.get('/transactions', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userTransactions = await db.query.transactions.findMany({
      where: eq(transactions.userId, req.userId!),
      with: {
        splitEvent: true,
      },
      orderBy: (transactions, { desc }) => [desc(transactions.createdAt)],
    });

    res.json(userTransactions);
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

export default router;
