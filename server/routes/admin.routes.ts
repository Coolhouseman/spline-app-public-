import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL || 'https://vhicohutiocnfjwsofhy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const adminEmails = new Set<string>();
let adminEmailsLoaded = false;

async function loadAdminEmails() {
  if (adminEmailsLoaded) return;
  
  const { data } = await supabase.from('admin_roles').select('email');
  if (data) {
    data.forEach(row => adminEmails.add(row.email.toLowerCase()));
  }
  adminEmailsLoaded = true;
}

async function verifyAdminAccess(email: string): Promise<boolean> {
  await loadAdminEmails();
  return adminEmails.has(email.toLowerCase());
}

router.post('/verify', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ authorized: false, error: 'Email is required' });
    }

    const { data, error } = await supabase.rpc('verify_admin_access', {
      p_email: email.toLowerCase()
    });

    if (error) {
      console.error('Admin verify error:', error);
      return res.status(500).json({ authorized: false, error: error.message });
    }

    res.json(data);
  } catch (error: any) {
    console.error('Admin verify error:', error);
    res.status(500).json({ authorized: false, error: error.message });
  }
});

router.get('/metrics', async (req, res) => {
  try {
    const email = req.headers['x-admin-email'] as string;
    
    if (!email || !(await verifyAdminAccess(email))) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase.rpc('get_admin_dashboard_metrics');

    if (error) {
      console.error('Metrics error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error: any) {
    console.error('Metrics error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/buffer', async (req, res) => {
  try {
    const email = req.headers['x-admin-email'] as string;
    
    if (!email || !(await verifyAdminAccess(email))) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase.rpc('get_buffer_analysis');

    if (error) {
      console.error('Buffer analysis error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error: any) {
    console.error('Buffer analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/trends', async (req, res) => {
  try {
    const email = req.headers['x-admin-email'] as string;
    
    if (!email || !(await verifyAdminAccess(email))) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const days = parseInt(req.query.days as string) || 30;

    const { data, error } = await supabase.rpc('get_transaction_trends', {
      p_days: days
    });

    if (error) {
      console.error('Trends error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error: any) {
    console.error('Trends error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const email = req.headers['x-admin-email'] as string;
    
    if (!email || !(await verifyAdminAccess(email))) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const type = req.query.type as string || null;

    const { data, error } = await supabase.rpc('get_admin_transactions', {
      p_limit: limit,
      p_offset: offset,
      p_type: type
    });

    if (error) {
      console.error('Transactions error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error: any) {
    console.error('Transactions error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/admins', async (req, res) => {
  try {
    const email = req.headers['x-admin-email'] as string;
    
    if (!email || !(await verifyAdminAccess(email))) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase
      .from('admin_roles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Admins list error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error: any) {
    console.error('Admins list error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/admins', async (req, res) => {
  try {
    const adminEmail = req.headers['x-admin-email'] as string;
    
    if (!adminEmail || !(await verifyAdminAccess(adminEmail))) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { email, name, role } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const { data, error } = await supabase
      .from('admin_roles')
      .insert({
        email: email.toLowerCase(),
        name: name || null,
        role: role || 'admin'
      })
      .select()
      .single();

    if (error) {
      console.error('Add admin error:', error);
      return res.status(500).json({ error: error.message });
    }

    adminEmailsLoaded = false;
    res.json(data);
  } catch (error: any) {
    console.error('Add admin error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/admins/:email', async (req, res) => {
  try {
    const adminEmail = req.headers['x-admin-email'] as string;
    
    if (!adminEmail || !(await verifyAdminAccess(adminEmail))) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const emailToDelete = req.params.email;

    if (emailToDelete.toLowerCase() === 'admin@spline.nz') {
      return res.status(400).json({ error: 'Cannot delete the primary admin' });
    }

    const { error } = await supabase
      .from('admin_roles')
      .delete()
      .eq('email', emailToDelete.toLowerCase());

    if (error) {
      console.error('Delete admin error:', error);
      return res.status(500).json({ error: error.message });
    }

    adminEmailsLoaded = false;
    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete admin error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/export/transactions', async (req, res) => {
  try {
    const email = req.headers['x-admin-email'] as string;
    
    if (!email || !(await verifyAdminAccess(email))) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase.rpc('get_admin_transactions', {
      p_limit: 10000,
      p_offset: 0,
      p_type: null
    });

    if (error || !data?.transactions) {
      return res.status(500).json({ error: error?.message || 'No data' });
    }

    const csvHeader = 'ID,User ID,User Name,User Email,Type,Amount,Description,Direction,BlinkPay Fee,Fast Fee,Created At\n';
    const csvRows = data.transactions.map((tx: any) => 
      `"${tx.id}","${tx.user_id}","${tx.user_name || ''}","${tx.user_email || ''}","${tx.type}","${tx.amount}","${tx.description || ''}","${tx.direction}","${tx.estimated_blinkpay_fee || 0}","${tx.fast_withdrawal_fee || 0}","${tx.created_at}"`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=spline-transactions-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csvHeader + csvRows);
  } catch (error: any) {
    console.error('Export error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
