import express from 'express';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

const supabaseAdmin = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface AuthenticatedRequest extends express.Request {
  user?: { id: string; email: string };
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
  
  verifyUserToken(token).then(user => {
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    req.user = user;
    next();
  }).catch(err => {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Authentication error' });
  });
}

router.post('/create-customer', async (req, res) => {
  try {
    const { email, name, userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        spline_user_id: userId,
      },
    });

    res.json({ customerId: customer.id });
  } catch (error: any) {
    console.error('Error creating Stripe customer:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/create-setup-intent', async (req, res) => {
  try {
    const { customerId } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
    });

    res.json({
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
    });
  } catch (error: any) {
    console.error('Error creating SetupIntent:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/confirm-setup', async (req, res) => {
  try {
    const { setupIntentId } = req.body;

    if (!setupIntentId) {
      return res.status(400).json({ error: 'SetupIntent ID is required' });
    }

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
    });
  } catch (error: any) {
    console.error('Error confirming setup:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/charge', async (req, res) => {
  try {
    const { customerId, paymentMethodId, amount, description, metadata } = req.body;

    if (!customerId || !paymentMethodId || !amount) {
      return res.status(400).json({ 
        error: 'Customer ID, payment method ID, and amount are required' 
      });
    }

    const amountInCents = Math.round(amount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'nzd',
      customer: customerId,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      description: description || 'Spline payment',
      metadata: metadata || {},
    });

    if (paymentIntent.status === 'succeeded') {
      res.json({
        success: true,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
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

router.get('/payment-method/:id', async (req, res) => {
  try {
    const { id } = req.params;
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

router.delete('/payment-method/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await stripe.paymentMethods.detach(id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error detaching payment method:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/publishable-key', (req, res) => {
  res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

router.post('/initiate-card-setup', async (req, res) => {
  try {
    const { userId, email, name } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    let customerId = req.body.customerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: {
          spline_user_id: userId,
        },
      });
      customerId = customer.id;
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
    });

    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
    // Use x-forwarded headers (set by Replit's proxy) or fallback to production URL
    const forwardedHost = req.get('x-forwarded-host');
    const forwardedProto = req.get('x-forwarded-proto') || 'https';
    const directHost = req.get('host') || 'localhost:8082';
    
    // Prefer forwarded host (from proxy), then check for production
    let baseUrl: string;
    if (forwardedHost) {
      baseUrl = `${forwardedProto}://${forwardedHost}`;
    } else if (directHost.includes('localhost')) {
      baseUrl = `http://${directHost}`;
    } else {
      // Production fallback - use hardcoded production URL
      baseUrl = 'https://splinepay.replit.app';
    }
    
    console.log(`Card setup URL base: ${baseUrl} (forwardedHost: ${forwardedHost}, directHost: ${directHost})`);

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
    });
  } catch (error: any) {
    console.error('Error initiating card setup:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/create-native-setup-intent', async (req, res) => {
  try {
    const { userId, email, name } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    let customerId = req.body.customerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: {
          spline_user_id: userId,
        },
      });
      customerId = customer.id;
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
    });

    console.log(`Created native setup intent for user ${userId}: ${setupIntent.id}`);

    res.json({
      customerId,
      setupIntentId: setupIntent.id,
      clientSecret: setupIntent.client_secret,
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

    console.log(`Verified native setup for authenticated user ${authenticatedUserId}, customer ${customerId}: ${paymentMethodId}`);

    res.json({
      success: true,
      paymentMethodId,
      card: {
        brand: paymentMethod.card.brand || 'card',
        last4: paymentMethod.card.last4 || '****',
        exp_month: paymentMethod.card.exp_month,
        exp_year: paymentMethod.card.exp_year,
      },
    });
  } catch (error: any) {
    console.error('Error verifying native setup:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
