import express from 'express';
import Stripe from 'stripe';

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

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

export default router;
