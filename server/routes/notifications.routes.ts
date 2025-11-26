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
    const { user_id, type, title, message, metadata, split_event_id, friendship_id } = req.body;

    if (!user_id || !type || !title || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log('Creating notification for user:', user_id, 'type:', type);

    const { data, error } = await supabaseAdmin.from('notifications').insert({
      user_id,
      type,
      title,
      message,
      metadata: metadata || {},
      split_event_id: split_event_id || null,
      friendship_id: friendship_id || null,
      read: false,
    }).select().single();

    if (error) {
      console.error('Failed to create notification:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('Notification created successfully:', data.id);
    res.json({ success: true, notification: data });
  } catch (error: any) {
    console.error('Notification creation error:', error);
    res.status(500).json({ error: error.message || 'Failed to create notification' });
  }
});

// Create a test user in Supabase (for testing purposes)
router.post('/test-user', async (req, res) => {
  try {
    const { name, email, unique_id } = req.body;

    if (!name || !email || !unique_id) {
      return res.status(400).json({ error: 'Missing required fields: name, email, unique_id' });
    }

    console.log('Creating test user with unique_id:', unique_id);

    const { data, error } = await supabaseAdmin.from('users').insert({
      name,
      email,
      unique_id,
    }).select().single();

    if (error) {
      console.error('Failed to create test user:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('Test user created successfully:', data.id);
    res.json({ success: true, user: data });
  } catch (error: any) {
    console.error('Test user creation error:', error);
    res.status(500).json({ error: error.message || 'Failed to create test user' });
  }
});

// Lookup user by unique_id (for testing purposes)
router.get('/lookup-user/:unique_id', async (req, res) => {
  try {
    const { unique_id } = req.params;

    console.log('Looking up user with unique_id:', unique_id);

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, name, unique_id')
      .eq('unique_id', unique_id)
      .maybeSingle();

    if (error) {
      console.error('User lookup error:', error);
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user: data });
  } catch (error: any) {
    console.error('User lookup error:', error);
    res.status(500).json({ error: error.message || 'Failed to lookup user' });
  }
});

export default router;
