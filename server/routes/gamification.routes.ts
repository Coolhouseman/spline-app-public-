import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { sendVoucherClaimNotification, sendSuspiciousActivityNotification } from '../services/email.service';

const router = express.Router();

const supabaseUrl = 'https://vhicohutiocnfjwsofhy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface AuthenticatedRequest extends express.Request {
  user?: { id: string; email: string };
}

async function verifyUserToken(token: string): Promise<{ id: string; email: string } | null> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey || '', {
      db: { schema: 'public' },
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    const { data, error } = await supabase.auth.getUser(token);
    
    if (error || !data.user) {
      return null;
    }
    
    return { id: data.user.id, email: data.user.email || '' };
  } catch (err) {
    console.error('Token verification error:', err);
    return null;
  }
}

const userAuthMiddleware = async (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No authorization token provided' });
  }
  
  const token = authHeader.split(' ')[1];
  const user = await verifyUserToken(token);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  req.user = user;
  next();
};

const VOUCHER_REQUIREMENTS: Record<string, { requiredLevel: number; value: string }> = {
  dinner_voucher: { requiredLevel: 10, value: '$50 Dinner Voucher' },
};

router.post('/claim-voucher', userAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { voucherType } = req.body;

    if (!voucherType) {
      return res.status(400).json({ error: 'Missing voucher type' });
    }

    const voucherConfig = VOUCHER_REQUIREMENTS[voucherType];
    if (!voucherConfig) {
      return res.status(400).json({ error: 'Invalid voucher type' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey || '', {
      db: { schema: 'public' },
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('first_name, last_name, email, phone')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { data: gamProfile, error: gamError } = await supabase
      .from('user_gamification')
      .select('level')
      .eq('user_id', userId)
      .single();

    if (gamError || !gamProfile) {
      return res.status(404).json({ error: 'Gamification profile not found' });
    }

    if (gamProfile.level < voucherConfig.requiredLevel) {
      return res.status(403).json({ error: `Level ${voucherConfig.requiredLevel} required to claim this voucher` });
    }

    const { data: existingClaim, error: claimCheckError } = await supabase
      .from('voucher_claims')
      .select('id')
      .eq('user_id', userId)
      .eq('voucher_type', voucherType)
      .maybeSingle();

    if (existingClaim) {
      return res.status(400).json({ error: 'You have already claimed this voucher' });
    }

    const claimedAt = new Date().toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' });

    const { error: insertError } = await supabase
      .from('voucher_claims')
      .insert({
        user_id: userId,
        voucher_type: voucherType,
        voucher_value: voucherConfig.value,
        level_required: voucherConfig.requiredLevel,
        status: 'pending'
      });

    if (insertError) {
      if (insertError.code === '42P01') {
        console.log('voucher_claims table does not exist yet, skipping insert');
      } else {
        console.error('Error inserting voucher claim:', insertError);
      }
    }

    await sendVoucherClaimNotification({
      userId,
      userName: `${userData.first_name} ${userData.last_name}`,
      userEmail: userData.email,
      userPhone: userData.phone || 'Not provided',
      level: gamProfile.level,
      voucherType,
      voucherValue: voucherConfig.value,
      claimedAt
    });

    res.json({ 
      success: true, 
      message: 'Voucher claimed successfully. Our team will be in touch soon!' 
    });

  } catch (error: any) {
    console.error('Voucher claim error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/report-suspicious', userAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId, activityType, details } = req.body;

    const supabase = createClient(supabaseUrl, supabaseServiceKey || '', {
      db: { schema: 'public' },
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('first_name, last_name, email')
      .eq('id', userId)
      .maybeSingle();

    const timestamp = new Date().toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' });

    await sendSuspiciousActivityNotification({
      userId,
      userName: userData ? `${userData.first_name} ${userData.last_name}` : 'Unknown',
      userEmail: userData?.email || 'Unknown',
      activityType,
      details,
      timestamp
    });

    res.json({ success: true });

  } catch (error: any) {
    console.error('Suspicious activity report error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
