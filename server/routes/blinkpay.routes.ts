import express from 'express';
import { BlinkPayService } from '../services/blinkpay.service';

const router = express.Router();

router.post('/consent/create', async (req, res) => {
  try {
    const { redirectUri, maxAmountPerPeriod } = req.body;
    
    if (!redirectUri) {
      return res.status(400).json({ error: 'redirectUri is required' });
    }

    const result = await BlinkPayService.createEnduringConsent(
      redirectUri,
      maxAmountPerPeriod || '1000.00'
    );
    
    res.json(result);
  } catch (error: any) {
    console.error('Error creating consent:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/consent/:consentId', async (req, res) => {
  try {
    const { consentId } = req.params;
    
    const result = await BlinkPayService.getEnduringConsent(consentId);
    
    res.json(result);
  } catch (error: any) {
    console.error('Error getting consent:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/consent/revoke', async (req, res) => {
  try {
    const { consentId } = req.body;
    
    if (!consentId) {
      return res.status(400).json({ error: 'consentId is required' });
    }

    await BlinkPayService.revokeEnduringConsent(consentId);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error revoking consent:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/payment', async (req, res) => {
  try {
    const { consentId, amount, particulars, reference } = req.body;
    
    if (!consentId || !amount) {
      return res.status(400).json({ error: 'consentId and amount are required' });
    }

    const result = await BlinkPayService.createPayment(
      consentId,
      amount,
      particulars || 'Split Payment',
      reference || 'SPLIT'
    );
    
    res.json(result);
  } catch (error: any) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/payment/create', async (req, res) => {
  try {
    const { consentId, amount, particulars, reference } = req.body;
    
    if (!consentId || !amount) {
      return res.status(400).json({ error: 'consentId and amount are required' });
    }

    const result = await BlinkPayService.createPayment(
      consentId,
      amount,
      particulars || 'Split Payment',
      reference || 'SPLIT'
    );
    
    res.json(result);
  } catch (error: any) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/payment/:paymentId/status', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { maxWaitSeconds } = req.query;
    
    const result = await BlinkPayService.awaitSuccessfulPayment(
      paymentId,
      maxWaitSeconds ? parseInt(maxWaitSeconds as string) : 30
    );
    
    res.json(result);
  } catch (error: any) {
    console.error('Error checking payment status:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
