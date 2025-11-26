import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

router.post('/create', async (req, res) => {
  try {
    const { user_id, type, title, message, metadata, split_event_id } = req.body;

    if (!user_id || !type || !title || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { data, error } = await supabaseAdmin.from('notifications').insert({
      user_id,
      type,
      title,
      message,
      metadata: metadata || {},
      split_event_id: split_event_id || null,
      read: false,
    }).select().single();

    if (error) {
      console.error('Failed to create notification:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, notification: data });
  } catch (error: any) {
    console.error('Notification creation error:', error);
    res.status(500).json({ error: error.message || 'Failed to create notification' });
  }
});

export default router;
