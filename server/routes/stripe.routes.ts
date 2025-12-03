import express from 'express';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const stripeLive = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const stripeTest = new Stripe(process.env.STRIPE_TEST_SECRET_KEY || '');

function getStripeInstance(testMode: boolean): Stripe {
  return testMode ? stripeTest : stripeLive;
}

function getPublishableKey(testMode: boolean): string {
  return testMode 
    ? (process.env.STRIPE_TEST_PUBLISHABLE_KEY || '')
    : (process.env.STRIPE_PUBLISHABLE_KEY || '');
}

const supabaseAdmin = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface AuthenticatedRequest extends express.Request {
  user?: { id: string; email: string };
  stripeTestMode?: boolean;
}

async function verifyUserToken(token: string): Promise<{ id: string; email: string } | null> {
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !data.user) {
      console.error('Token verification failed:', error?.message);
      return null;
    }
    
    return { id: data.user.id, email: data.user.email || '' };
  } catch (err) {
    console.error('Token verification error:', err);
    return null;
  }
}

async function checkUserTestMode(userId: string): Promise<boolean> {
  try {
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('stripe_test_mode')
      .eq('user_id', userId)
      .single();
    
    return wallet?.stripe_test_mode === true;
  } catch (err) {
    return false;
  }
}

function userAuthMiddleware(
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  
  verifyUserToken(token).then(async user => {
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    req.user = user;
    req.stripeTestMode = await checkUserTestMode(user.id);
    next();
  }).catch(err => {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Authentication error' });
  });
}

router.get('/publishable-key/:userId', async (req, res) => {
  const { userId } = req.params;
  const testMode = await checkUserTestMode(userId);
  const publishableKey = getPublishableKey(testMode);
  
  if (!publishableKey) {
    return res.status(500).json({ error: 'Stripe publishable key not configured' });
  }
  
  res.json({ publishableKey, testMode });
});

router.post('/create-customer', async (req, res) => {
  try {
    const { email, name, userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const testMode = await checkUserTestMode(userId);
    const stripe = getStripeInstance(testMode);

    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        spline_user_id: userId,
        test_mode: testMode ? 'true' : 'false',
      },
    });

    console.log(`Created Stripe customer ${customer.id} for user ${userId} (testMode: ${testMode})`);

    res.json({ customerId: customer.id, testMode });
  } catch (error: any) {
    console.error('Error creating Stripe customer:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/create-setup-intent', async (req, res) => {
  try {
    const { customerId, userId } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const testMode = await checkUserTestMode(userId);
    const stripe = getStripeInstance(testMode);

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
    });

    res.json({
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
      testMode,
    });
  } catch (error: any) {
    console.error('Error creating SetupIntent:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/confirm-setup', async (req, res) => {
  try {
    const { setupIntentId, userId } = req.body;

    if (!setupIntentId) {
      return res.status(400).json({ error: 'SetupIntent ID is required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const testMode = await checkUserTestMode(userId);
    const stripe = getStripeInstance(testMode);

    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

    if (setupIntent.status !== 'succeeded') {
      return res.status(400).json({ 
        error: 'SetupIntent not confirmed',
        status: setupIntent.status 
      });
    }

    const paymentMethodId = setupIntent.payment_method as string;
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    res.json({
      paymentMethodId,
      card: {
        brand: paymentMethod.card?.brand,
        last4: paymentMethod.card?.last4,
        exp_month: paymentMethod.card?.exp_month,
        exp_year: paymentMethod.card?.exp_year,
      },
      testMode,
    });
  } catch (error: any) {
    console.error('Error confirming setup:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/charge', userAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { customerId, paymentMethodId, amount, description, metadata } = req.body;
    const userId = req.user?.id;
    const testMode = req.stripeTestMode || false;

    if (!customerId || !paymentMethodId || !amount) {
      return res.status(400).json({ 
        error: 'Customer ID, payment method ID, and amount are required' 
      });
    }

    const stripe = getStripeInstance(testMode);
    const amountInCents = Math.round(amount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'nzd',
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      description: description || 'Spline payment',
      metadata: { ...(metadata || {}), test_mode: testMode ? 'true' : 'false', user_id: userId || '' },
    });

    console.log(`Stripe charge ${paymentIntent.id}: $${amount} by user ${userId} (testMode: ${testMode})`);

    if (paymentIntent.status === 'succeeded') {
      res.json({
        success: true,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        testMode,
      });
    } else {
      res.status(400).json({
        success: false,
        status: paymentIntent.status,
        error: 'Payment not completed',
      });
    }
  } catch (error: any) {
    console.error('Error charging card:', error);
    
    if (error.type === 'StripeCardError') {
      res.status(400).json({
        error: error.message,
        code: error.code,
        decline_code: error.decline_code,
      });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.get('/payment-method/:id', userAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const testMode = req.stripeTestMode || false;
    const stripe = getStripeInstance(testMode);
    
    const paymentMethod = await stripe.paymentMethods.retrieve(id);

    res.json({
      id: paymentMethod.id,
      card: {
        brand: paymentMethod.card?.brand,
        last4: paymentMethod.card?.last4,
        exp_month: paymentMethod.card?.exp_month,
        exp_year: paymentMethod.card?.exp_year,
      },
    });
  } catch (error: any) {
    console.error('Error retrieving payment method:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/payment-method/:id', userAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const testMode = req.stripeTestMode || false;
    const stripe = getStripeInstance(testMode);
    
    await stripe.paymentMethods.detach(id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error detaching payment method:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/initiate-card-setup', async (req, res) => {
  try {
    const { userId, email, name, customerId: existingCustomerId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const testMode = await checkUserTestMode(userId);
    const stripe = getStripeInstance(testMode);
    const publishableKey = getPublishableKey(testMode);

    let customerId = existingCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: {
          spline_user_id: userId,
          test_mode: testMode ? 'true' : 'false',
        },
      });
      customerId = customer.id;
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
    });

    const forwardedHost = req.get('x-forwarded-host');
    const forwardedProto = req.get('x-forwarded-proto') || 'https';
    const directHost = req.get('host') || 'localhost:8082';
    
    let baseUrl: string;
    if (forwardedHost) {
      baseUrl = `${forwardedProto}://${forwardedHost}`;
    } else if (directHost.includes('localhost')) {
      baseUrl = `http://${directHost}`;
    } else {
      baseUrl = 'https://splinepay.replit.app';
    }
    
    console.log(`Card setup for user ${userId}: ${setupIntent.id} (testMode: ${testMode})`);

    const cardSetupUrl = `${baseUrl}/card-setup.html?` + 
      `client_secret=${setupIntent.client_secret}` +
      `&setup_intent_id=${setupIntent.id}` +
      `&user_id=${userId}` +
      `&pk=${publishableKey}` +
      `&return_url=splitpaymentapp://stripe-callback`;

    res.json({
      customerId,
      setupIntentId: setupIntent.id,
      cardSetupUrl,
      testMode,
    });
  } catch (error: any) {
    console.error('Error initiating card setup:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/create-native-setup-intent', async (req, res) => {
  try {
    const { userId, email, name, customerId: existingCustomerId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const testMode = await checkUserTestMode(userId);
    const stripe = getStripeInstance(testMode);
    const publishableKey = getPublishableKey(testMode);

    let customerId = existingCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: {
          spline_user_id: userId,
          test_mode: testMode ? 'true' : 'false',
        },
      });
      customerId = customer.id;
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
    });

    console.log(`Native setup intent for user ${userId}: ${setupIntent.id} (testMode: ${testMode})`);

    res.json({
      customerId,
      setupIntentId: setupIntent.id,
      clientSecret: setupIntent.client_secret,
      publishableKey,
      testMode,
    });
  } catch (error: any) {
    console.error('Error creating native setup intent:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/verify-native-setup', userAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { paymentMethodId, customerId, setupIntentId } = req.body;
    const authenticatedUserId = req.user!.id;
    const testMode = req.stripeTestMode || false;
    const stripe = getStripeInstance(testMode);

    if (!paymentMethodId || !customerId || !setupIntentId) {
      return res.status(400).json({ error: 'Payment method ID, customer ID, and setup intent ID are required' });
    }

    const customer = await stripe.customers.retrieve(customerId);
    if (!customer || customer.deleted) {
      return res.status(400).json({ error: 'Invalid customer' });
    }

    if ((customer as Stripe.Customer).metadata?.spline_user_id !== authenticatedUserId) {
      console.error(`User ID mismatch: authenticated ${authenticatedUserId}, customer metadata ${(customer as Stripe.Customer).metadata?.spline_user_id}`);
      return res.status(403).json({ error: 'Unauthorized: You do not own this payment customer' });
    }

    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

    if (setupIntent.status !== 'succeeded') {
      return res.status(400).json({ 
        error: 'Setup intent not confirmed',
        status: setupIntent.status 
      });
    }

    if (setupIntent.customer !== customerId) {
      return res.status(400).json({ error: 'Customer mismatch' });
    }

    if (setupIntent.payment_method !== paymentMethodId) {
      return res.status(400).json({ error: 'Payment method mismatch' });
    }

    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    if (!paymentMethod || !paymentMethod.card) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    console.log(`Verified native setup for user ${authenticatedUserId}: ${paymentMethodId} (testMode: ${testMode})`);

    res.json({
      success: true,
      paymentMethodId,
      card: {
        brand: paymentMethod.card.brand || 'card',
        last4: paymentMethod.card.last4 || '****',
        exp_month: paymentMethod.card.exp_month,
        exp_year: paymentMethod.card.exp_year,
      },
      testMode,
    });
  } catch (error: any) {
    console.error('Error verifying native setup:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/process-split-payment', userAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { amount, splitEventId, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Amount must be greater than zero' });
    }

    if (!splitEventId) {
      return res.status(400).json({ success: false, error: 'Split event ID is required' });
    }

    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('id, balance')
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      console.error('Wallet not found:', walletError);
      return res.status(400).json({ success: false, error: 'Wallet not found' });
    }

    const currentBalance = parseFloat(wallet.balance?.toString() || '0');

    if (currentBalance < amount) {
      return res.status(400).json({ 
        success: false, 
        error: 'Insufficient balance',
        current_balance: currentBalance
      });
    }

    const newBalance = currentBalance - amount;

    const { error: updateError } = await supabaseAdmin
      .from('wallets')
      .update({ 
        balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', wallet.id)
      .eq('balance', currentBalance);

    if (updateError) {
      console.error('Failed to update wallet:', updateError);
      return res.status(500).json({ success: false, error: 'Failed to update wallet balance' });
    }

    const { data: transaction, error: txError } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'split_payment',
        amount: amount,
        description: description || 'Split payment',
        direction: 'out',
        split_event_id: splitEventId,
        metadata: { split_event_id: splitEventId, payer_id: userId }
      })
      .select('id')
      .single();

    if (txError) {
      console.error('Failed to log transaction:', txError);
      await supabaseAdmin
        .from('wallets')
        .update({ balance: currentBalance })
        .eq('id', wallet.id);
      return res.status(500).json({ success: false, error: 'Failed to log transaction' });
    }

    console.log(`Split payment: $${amount} from user ${userId}, new balance: $${newBalance}`);

    res.json({
      success: true,
      new_balance: newBalance,
      transaction_id: transaction.id
    });
  } catch (error: any) {
    console.error('Error processing split payment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
