import { Router, Request, Response } from 'express';

const router = Router();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const serviceSid = process.env.TWILIO_SERVICE_SID;

let twilioClient: any = null;

const getTwilioClient = () => {
  if (!twilioClient && accountSid && authToken) {
    try {
      const twilio = require('twilio');
      twilioClient = twilio(accountSid, authToken);
    } catch (error) {
      console.error('Failed to initialize Twilio client:', error);
    }
  }
  return twilioClient;
};

router.post('/send-otp', async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        error: 'Phone number is required' 
      });
    }

    const client = getTwilioClient();
    
    if (!client || !serviceSid) {
      console.log('Twilio not configured, returning mock success for development');
      return res.status(200).json({ 
        success: true, 
        status: 'pending',
        message: 'Development mode: OTP simulation sent'
      });
    }

    const verification = await client.verify.v2
      .services(serviceSid)
      .verifications
      .create({ 
        to: phoneNumber,
        channel: 'sms'
      });

    console.log('Twilio OTP sent:', verification.status);
    
    res.status(200).json({ 
      success: true, 
      status: verification.status 
    });
  } catch (error: any) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to send verification code' 
    });
  }
});

router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const { phoneNumber, code } = req.body;

    if (!phoneNumber || !code) {
      return res.status(400).json({ 
        success: false, 
        error: 'Phone number and code are required' 
      });
    }

    const client = getTwilioClient();
    
    if (!client || !serviceSid) {
      console.log('Twilio not configured, accepting any 6-digit code for development');
      const isValidCode = /^\d{6}$/.test(code);
      return res.status(200).json({ 
        success: true, 
        valid: isValidCode,
        message: isValidCode ? 'Development mode: Code accepted' : 'Invalid code format'
      });
    }

    const verificationCheck = await client.verify.v2
      .services(serviceSid)
      .verificationChecks
      .create({ 
        to: phoneNumber, 
        code: code 
      });

    console.log('Twilio verification status:', verificationCheck.status);
    
    const isValid = verificationCheck.status === 'approved';
    
    res.status(200).json({ 
      success: true, 
      valid: isValid,
      status: verificationCheck.status
    });
  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    
    if (error.code === 20404) {
      return res.status(400).json({ 
        success: false, 
        valid: false,
        error: 'Verification code expired. Please request a new one.' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      valid: false,
      error: error.message || 'Failed to verify code' 
    });
  }
});

export default router;
