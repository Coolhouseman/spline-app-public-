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

interface RateLimitEntry {
  count: number;
  firstRequest: number;
  lastRequest: number;
}

const OTP_RATE_LIMITS = {
  PHONE_MAX_REQUESTS_10MIN: 4,
  PHONE_MAX_REQUESTS_HOUR: 5,
  IP_MAX_REQUESTS_HOUR: 7,
  TEN_MINUTES_MS: 10 * 60 * 1000,
  ONE_HOUR_MS: 60 * 60 * 1000,
};

const phoneRateLimits = new Map<string, RateLimitEntry>();
const ipRateLimits = new Map<string, RateLimitEntry>();

const cleanupRateLimits = () => {
  const now = Date.now();
  for (const [key, entry] of phoneRateLimits.entries()) {
    if (now - entry.lastRequest > OTP_RATE_LIMITS.ONE_HOUR_MS) {
      phoneRateLimits.delete(key);
    }
  }
  for (const [key, entry] of ipRateLimits.entries()) {
    if (now - entry.lastRequest > OTP_RATE_LIMITS.ONE_HOUR_MS) {
      ipRateLimits.delete(key);
    }
  }
};

setInterval(cleanupRateLimits, 5 * 60 * 1000);

const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0];
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
};

const checkPhoneRateLimit = (phoneNumber: string): { allowed: boolean; message?: string; retryAfterMinutes?: number } => {
  const now = Date.now();
  const entry = phoneRateLimits.get(phoneNumber);
  
  if (!entry) {
    phoneRateLimits.set(phoneNumber, { count: 1, firstRequest: now, lastRequest: now });
    return { allowed: true };
  }
  
  if (now - entry.firstRequest < OTP_RATE_LIMITS.TEN_MINUTES_MS) {
    if (entry.count >= OTP_RATE_LIMITS.PHONE_MAX_REQUESTS_10MIN) {
      const retryAfter = Math.ceil((OTP_RATE_LIMITS.TEN_MINUTES_MS - (now - entry.firstRequest)) / 60000);
      return { 
        allowed: false, 
        message: `Too many OTP requests. Please try again in ${retryAfter} minutes.`,
        retryAfterMinutes: retryAfter
      };
    }
  } else if (now - entry.firstRequest < OTP_RATE_LIMITS.ONE_HOUR_MS) {
    if (entry.count >= OTP_RATE_LIMITS.PHONE_MAX_REQUESTS_HOUR) {
      const retryAfter = Math.ceil((OTP_RATE_LIMITS.ONE_HOUR_MS - (now - entry.firstRequest)) / 60000);
      return { 
        allowed: false, 
        message: `Too many OTP requests. Please try again in ${retryAfter} minutes.`,
        retryAfterMinutes: retryAfter
      };
    }
  } else {
    phoneRateLimits.set(phoneNumber, { count: 1, firstRequest: now, lastRequest: now });
    return { allowed: true };
  }
  
  entry.count++;
  entry.lastRequest = now;
  return { allowed: true };
};

const checkIpRateLimit = (ip: string): { allowed: boolean; message?: string; retryAfterMinutes?: number } => {
  const now = Date.now();
  const entry = ipRateLimits.get(ip);
  
  if (!entry) {
    ipRateLimits.set(ip, { count: 1, firstRequest: now, lastRequest: now });
    return { allowed: true };
  }
  
  if (now - entry.firstRequest < OTP_RATE_LIMITS.ONE_HOUR_MS) {
    if (entry.count >= OTP_RATE_LIMITS.IP_MAX_REQUESTS_HOUR) {
      const retryAfter = Math.ceil((OTP_RATE_LIMITS.ONE_HOUR_MS - (now - entry.firstRequest)) / 60000);
      return { 
        allowed: false, 
        message: `Too many OTP requests from this network. Please try again in ${retryAfter} minutes.`,
        retryAfterMinutes: retryAfter
      };
    }
  } else {
    ipRateLimits.set(ip, { count: 1, firstRequest: now, lastRequest: now });
    return { allowed: true };
  }
  
  entry.count++;
  entry.lastRequest = now;
  return { allowed: true };
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

    const clientIp = getClientIp(req);
    
    const ipCheck = checkIpRateLimit(clientIp);
    if (!ipCheck.allowed) {
      console.log(`OTP rate limit (IP): ${clientIp} blocked`);
      return res.status(429).json({ 
        success: false, 
        error: ipCheck.message,
        retryAfterMinutes: ipCheck.retryAfterMinutes
      });
    }
    
    const phoneCheck = checkPhoneRateLimit(phoneNumber);
    if (!phoneCheck.allowed) {
      console.log(`OTP rate limit (Phone): ${phoneNumber} blocked`);
      return res.status(429).json({ 
        success: false, 
        error: phoneCheck.message,
        retryAfterMinutes: phoneCheck.retryAfterMinutes
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
