import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const supabaseUrl = 'https://vhicohutiocnfjwsofhy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoaWNvaHV0aW9jbmZqd3NvZmh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzOTcwNTgsImV4cCI6MjA2Mzk3MzA1OH0.EI2qBBfKIoF5HZIFU_Ls62xi5A0EPKwylvKGl9ppwQA';

if (!supabaseServiceKey) {
  console.error('FATAL: SUPABASE_SERVICE_ROLE_KEY is not configured');
}

if (!supabaseAnonKey) {
  console.error('FATAL: SUPABASE_ANON_KEY is not configured');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || '');

interface AuthenticatedRequest extends express.Request {
  adminUser?: { id: string; email: string; role: string; name: string };
}

async function verifyAuthToken(token: string): Promise<{ id: string; email: string } | null> {
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

async function checkAdminRole(email: string): Promise<{ authorized: boolean; role?: string; name?: string }> {
  const { data, error } = await supabaseAdmin
    .from('admin_roles')
    .select('role, name')
    .eq('email', email.toLowerCase())
    .single();
  
  if (error || !data) {
    return { authorized: false };
  }
  
  return { authorized: true, role: data.role, name: data.name };
}

async function adminAuthMiddleware(
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const token = authHeader.replace('Bearer ', '');
  
  const user = await verifyAuthToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  const adminCheck = await checkAdminRole(user.email);
  if (!adminCheck.authorized) {
    return res.status(403).json({ error: 'Admin access denied for this account' });
  }
  
  req.adminUser = {
    id: user.id,
    email: user.email,
    role: adminCheck.role || 'admin',
    name: adminCheck.name || user.email
  };
  
  next();
}

router.post('/setup-admin', async (req, res) => {
  try {
    // Accept custom credentials from request body, or use defaults
    const adminEmail = req.body.email || 'admin@spline.nz';
    const adminPassword = req.body.password || 'SplineAdmin2024!';
    
    console.log('Setting up admin user:', adminEmail);
    
    // First, try to find and delete any existing user with this email
    // Paginate through all users to find the one we need
    let page = 1;
    let foundUserId: string | null = null;
    
    while (true) {
      const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 100
      });
      
      if (listError) {
        console.error('Error listing users:', listError);
        break;
      }
      
      if (!usersData?.users || usersData.users.length === 0) {
        break;
      }
      
      const existingUser = usersData.users.find(u => u.email?.toLowerCase() === adminEmail.toLowerCase());
      if (existingUser) {
        foundUserId = existingUser.id;
        console.log('Found existing user:', foundUserId);
        break;
      }
      
      // Check if we've reached the last page
      if (usersData.users.length < 100) {
        break;
      }
      
      page++;
    }
    
    // Delete existing user if found
    if (foundUserId) {
      console.log('Deleting existing user:', foundUserId);
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(foundUserId);
      if (deleteError) {
        console.error('Error deleting existing user:', deleteError);
        // Continue anyway - try to create new user
      } else {
        console.log('Existing user deleted successfully');
      }
    }
    
    // Create fresh admin user
    console.log('Creating new admin user...');
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true
    });
    
    if (error) {
      console.error('Error creating admin user:', error);
      return res.status(500).json({ error: 'Failed to create admin user', details: error.message });
    }
    
    console.log('Admin user created successfully:', data.user?.id);
    
    // Also add to admin_roles table in Supabase
    const { error: roleError } = await supabaseAdmin
      .from('admin_roles')
      .upsert({
        email: adminEmail.toLowerCase(),
        role: 'super_admin',
        name: 'Admin User'
      }, { onConflict: 'email' });
    
    if (roleError) {
      console.error('Error adding admin role:', roleError);
      // User is created but role wasn't added - still return success
    } else {
      console.log('Admin role added successfully');
    }
    
    res.json({ 
      success: true, 
      message: 'Admin user created successfully',
      email: adminEmail,
      userId: data.user?.id
    });
  } catch (error: any) {
    console.error('Setup admin error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('Admin login attempt for:', email);
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!supabaseAnonKey) {
      console.error('Admin login failed: SUPABASE_ANON_KEY not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    console.log('Using Supabase URL:', supabaseUrl);
    console.log('Attempting admin auth with service role key...');

    // Use supabaseAdmin (service role) to verify credentials by signing in
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      console.error('Supabase auth error:', authError.message, authError.status, authError.code);
      return res.status(401).json({ error: 'Invalid email or password', details: authError.message });
    }
    
    if (!authData.user) {
      console.error('No user returned from Supabase');
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    console.log('Supabase auth successful for:', authData.user.email);

    const adminCheck = await checkAdminRole(authData.user.email || '');
    if (!adminCheck.authorized) {
      await supabaseAdmin.auth.signOut();
      return res.status(403).json({ error: 'This account does not have admin access' });
    }

    res.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: adminCheck.role,
        name: adminCheck.name || authData.user.email
      },
      session: {
        access_token: authData.session?.access_token,
        expires_at: authData.session?.expires_at
      }
    });
  } catch (error: any) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      
      const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
      
      if (userError) {
        console.log('Logout - could not get user from token:', userError.message);
        return res.json({ success: true });
      }
      
      if (userData?.user?.id) {
        try {
          const revokeMethod = (supabaseAdmin.auth.admin as any).invalidateRefreshTokens;
          
          if (typeof revokeMethod === 'function') {
            const { error: revokeError } = await revokeMethod.call(
              supabaseAdmin.auth.admin,
              userData.user.id
            );
            
            if (revokeError) {
              console.error('Logout - invalidateRefreshTokens failed:', revokeError.message);
              return res.status(500).json({ success: false, error: 'Failed to revoke session' });
            }
            
            console.log('Logout - refresh tokens invalidated for user:', userData.user.id);
          } else {
            console.log('Logout - invalidateRefreshTokens not available, clearing client session only');
          }
        } catch (revokeErr: any) {
          console.error('Logout - revocation error:', revokeErr.message);
        }
      }
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.json({ success: true });
  }
});

router.get('/me', adminAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  res.json({
    authorized: true,
    ...req.adminUser
  });
});

router.get('/metrics', adminAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_admin_dashboard_metrics');

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

router.get('/buffer', adminAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_buffer_analysis');

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

router.get('/trends', adminAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;

    const { data, error } = await supabaseAdmin.rpc('get_transaction_trends', {
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

router.get('/transactions', adminAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const type = req.query.type as string || null;

    const { data, error } = await supabaseAdmin.rpc('get_admin_transactions', {
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

router.get('/admins', adminAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { data, error } = await supabaseAdmin
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

router.post('/admins', adminAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { email, name, role } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const { data, error } = await supabaseAdmin
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

    res.json(data);
  } catch (error: any) {
    console.error('Add admin error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/admins/:email', adminAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const emailToDelete = req.params.email;

    if (emailToDelete.toLowerCase() === 'admin@spline.nz') {
      return res.status(400).json({ error: 'Cannot delete the primary admin' });
    }

    const { error } = await supabaseAdmin
      .from('admin_roles')
      .delete()
      .eq('email', emailToDelete.toLowerCase());

    if (error) {
      console.error('Delete admin error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Delete admin error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/export/transactions', adminAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { data, error } = await supabaseAdmin.rpc('get_admin_transactions', {
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
