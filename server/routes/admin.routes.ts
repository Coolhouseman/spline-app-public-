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
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_roles')
      .select('role, name')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    
    if (error) {
      console.error('Admin role check error:', error.message);
      return { authorized: false };
    }
    
    if (!data) {
      return { authorized: false };
    }
    
    return { authorized: true, role: data.role, name: data.name };
  } catch (err) {
    console.error('Admin role check exception:', err);
    return { authorized: false };
  }
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
    // Get total wallet liabilities (sum of all wallet balances)
    // Note: For production with >1000 wallets, use PostgreSQL RPC for aggregation
    const { data: walletData, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .range(0, 99999);
    
    if (walletError) {
      console.error('Wallet query error:', walletError);
      return res.status(500).json({ error: walletError.message });
    }

    const totalLiabilities = walletData?.reduce((sum, w) => sum + Number(w.balance || 0), 0) || 0;
    const activeWalletCount = walletData?.filter(w => Number(w.balance || 0) > 0).length || 0;

    // Get transaction totals
    // Note: For production with >1000 transactions, use PostgreSQL RPC for aggregation
    const { data: txData, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('type, amount, metadata, created_at, description')
      .range(0, 99999);
    
    if (txError) {
      console.error('Transaction query error:', txError);
      return res.status(500).json({ error: txError.message });
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let deposits7d = 0;
    let withdrawals7d = 0;
    let deposits30d = 0;
    let withdrawals30d = 0;
    let fastWithdrawalFeeRevenue = 0;
    let depositTransactionCount = 0;
    let cardPaymentTransactionCount = 0;

    txData?.forEach(tx => {
      const amount = Number(tx.amount || 0);
      const createdAt = new Date(tx.created_at);

      if (tx.type === 'deposit') {
        totalDeposits += amount;
        depositTransactionCount++;
        if (createdAt >= thirtyDaysAgo) deposits30d += amount;
        if (createdAt >= sevenDaysAgo) deposits7d += amount;
      } else if (tx.type === 'withdrawal') {
        totalWithdrawals += amount;
        if (createdAt >= thirtyDaysAgo) withdrawals30d += amount;
        if (createdAt >= sevenDaysAgo) withdrawals7d += amount;
        
        if (tx.metadata?.withdrawal_type === 'fast' && tx.metadata?.fee_amount) {
          fastWithdrawalFeeRevenue += Number(tx.metadata.fee_amount);
        }
      } else if (tx.type === 'split_payment' && tx.description?.includes('from card')) {
        cardPaymentTransactionCount++;
      }
    });

    // Stripe fees absorbed: 2.9% + 30c per transaction (deposits + card-funded split payments)
    const totalCardTransactions = depositTransactionCount + cardPaymentTransactionCount;
    const stripePercentageFee = totalDeposits * 0.029;
    const stripeFixedFee = totalCardTransactions * 0.30;
    const stripeFeesAbsorbed = stripePercentageFee + stripeFixedFee;
    const netFeePosition = fastWithdrawalFeeRevenue - stripeFeesAbsorbed;

    res.json({
      total_wallet_liabilities: totalLiabilities,
      total_deposits: totalDeposits,
      total_withdrawals: totalWithdrawals,
      active_wallet_count: activeWalletCount,
      stripe_fees_absorbed: stripeFeesAbsorbed,
      fast_withdrawal_fee_revenue: fastWithdrawalFeeRevenue,
      net_fee_position: netFeePosition,
      deposits_7days: deposits7d,
      withdrawals_7days: withdrawals7d,
      deposits_30days: deposits30d,
      withdrawals_30days: withdrawals30d
    });
  } catch (error: any) {
    console.error('Metrics error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/buffer', adminAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    // Get total wallet liabilities
    // Note: For production with >1000 wallets, use PostgreSQL RPC for aggregation
    const { data: walletData, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .range(0, 99999);
    
    if (walletError) {
      return res.status(500).json({ error: walletError.message });
    }

    const totalLiabilities = walletData?.reduce((sum, w) => sum + Number(w.balance || 0), 0) || 0;

    // Get transaction data
    // Note: For production with >1000 transactions, use PostgreSQL RPC for aggregation
    const { data: txData, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('type, amount, metadata, created_at, description')
      .range(0, 99999);
    
    if (txError) {
      return res.status(500).json({ error: txError.message });
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let totalDeposits = 0;
    let totalWithdrawals = 0;
    let withdrawals7d = 0;
    let withdrawals30d = 0;
    let fastWithdrawalFeeRevenue = 0;
    let depositTransactionCount = 0;
    let cardPaymentTransactionCount = 0;

    txData?.forEach(tx => {
      const amount = Number(tx.amount || 0);
      const createdAt = new Date(tx.created_at);

      if (tx.type === 'deposit') {
        totalDeposits += amount;
        depositTransactionCount++;
      } else if (tx.type === 'withdrawal') {
        totalWithdrawals += amount;
        if (createdAt >= thirtyDaysAgo) withdrawals30d += amount;
        if (createdAt >= sevenDaysAgo) withdrawals7d += amount;
        
        if (tx.metadata?.withdrawal_type === 'fast' && tx.metadata?.fee_amount) {
          fastWithdrawalFeeRevenue += Number(tx.metadata.fee_amount);
        }
      } else if (tx.type === 'split_payment' && (tx.description as string)?.includes('from card')) {
        cardPaymentTransactionCount++;
      }
    });

    // Calculate Stripe fees (2.9% + 30c per transaction)
    const totalCardTransactions = depositTransactionCount + cardPaymentTransactionCount;
    const stripePercentageFee = totalDeposits * 0.029;
    const stripeFixedFee = totalCardTransactions * 0.30;
    const stripeFeesAbsorbed = stripePercentageFee + stripeFixedFee;

    // Net cash position = deposits received - Stripe fees paid - withdrawals sent out
    const netCashPosition = totalDeposits - stripeFeesAbsorbed - totalWithdrawals;

    // Buffer required = liabilities - cash position (what we need to cover shortfall)
    const bufferRequired = Math.max(0, totalLiabilities - netCashPosition);

    // Calculate average daily withdrawals for projections
    const daysIn7d = 7;
    const daysIn30d = 30;
    const avgDaily7d = withdrawals7d / daysIn7d;
    const avgDaily30d = withdrawals30d / daysIn30d;

    // Projections based on current withdrawal patterns
    const projection7d = bufferRequired + (avgDaily7d * 7);
    const projection30d = bufferRequired + (avgDaily30d * 30);

    // Determine status
    let status = 'healthy';
    let statusMessage = 'Cash position covers all liabilities';
    
    if (bufferRequired > 0) {
      if (bufferRequired > totalLiabilities * 0.5) {
        status = 'critical';
        statusMessage = 'Significant buffer shortfall';
      } else if (bufferRequired > totalLiabilities * 0.1) {
        status = 'warning';
        statusMessage = 'Minor buffer shortfall';
      }
    }

    res.json({
      total_liabilities: totalLiabilities,
      net_cash_position: netCashPosition,
      stripe_fees_paid: stripeFeesAbsorbed,
      fast_fee_revenue: fastWithdrawalFeeRevenue,
      buffer_required: bufferRequired,
      projection_7d: projection7d,
      projection_30d: projection30d,
      avg_daily_withdrawal_7d: avgDaily7d,
      avg_daily_withdrawal_30d: avgDaily30d,
      status,
      status_message: statusMessage
    });
  } catch (error: any) {
    console.error('Buffer analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/trends', adminAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: txData, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('type, amount, created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (txError) {
      return res.status(500).json({ error: txError.message });
    }

    // Group by date
    const dailyData: Record<string, { deposits: number; withdrawals: number }> = {};
    
    // Initialize all days with 0
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      dailyData[dateStr] = { deposits: 0, withdrawals: 0 };
    }

    // Aggregate transaction amounts
    txData?.forEach(tx => {
      const dateStr = tx.created_at.split('T')[0];
      const amount = Number(tx.amount || 0);
      
      if (!dailyData[dateStr]) {
        dailyData[dateStr] = { deposits: 0, withdrawals: 0 };
      }
      
      if (tx.type === 'deposit') {
        dailyData[dateStr].deposits += amount;
      } else if (tx.type === 'withdrawal') {
        dailyData[dateStr].withdrawals += amount;
      }
    });

    // Convert to array format for chart
    const trends = Object.entries(dailyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        deposits: data.deposits,
        withdrawals: data.withdrawals
      }));

    res.json(trends);
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

    // Build query
    let query = supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact' });
    
    if (type) {
      query = query.eq('type', type);
    }
    
    const { data: txData, error: txError, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (txError) {
      return res.status(500).json({ error: txError.message });
    }

    // Get user info for each transaction
    const userIds = [...new Set(txData?.map(tx => tx.user_id) || [])];
    
    const { data: usersData } = await supabaseAdmin
      .from('users')
      .select('id, name, email, phone, unique_id')
      .in('id', userIds);

    const userMap = new Map(usersData?.map(u => [u.id, u]) || []);

    // Combine transaction data with user info
    const transactions = txData?.map(tx => {
      const user = userMap.get(tx.user_id);
      const amount = Number(tx.amount);
      
      // Calculate Stripe fee estimate: 2.9% + 30c for deposits and card payments
      const isCardTransaction = tx.type === 'deposit' || 
        (tx.type === 'split_payment' && tx.description?.includes('from card'));
      const stripeFee = isCardTransaction ? (amount * 0.029 + 0.30) : 0;
      
      // Get fast withdrawal fee from metadata
      const fastFee = tx.metadata?.fee_amount || 0;
      
      return {
        id: tx.id,
        user_id: tx.user_id,
        user_name: user?.name || 'Unknown',
        user_email: user?.email || '',
        user_unique_id: user?.unique_id || '',
        type: tx.type,
        amount: amount,
        description: tx.description,
        direction: tx.direction,
        metadata: tx.metadata,
        estimated_stripe_fee: stripeFee,
        fast_withdrawal_fee: fastFee,
        created_at: tx.created_at
      };
    }) || [];

    res.json({
      transactions,
      total_count: count || 0
    });
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
    // Query transactions directly
    const { data: txData, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10000);

    if (txError) {
      return res.status(500).json({ error: txError.message });
    }

    // Get user info
    const userIds = [...new Set(txData?.map(tx => tx.user_id) || [])];
    const { data: usersData } = await supabaseAdmin
      .from('users')
      .select('id, name, email')
      .in('id', userIds);
    const userMap = new Map(usersData?.map(u => [u.id, u]) || []);

    const transactions = txData?.map(tx => {
      const user = userMap.get(tx.user_id);
      const amount = Number(tx.amount);
      // Stripe fee: 2.9% + 30c for deposits and card payments
      const isCardTransaction = tx.type === 'deposit' || 
        (tx.type === 'split_payment' && tx.description?.includes('from card'));
      const stripeFee = isCardTransaction ? (amount * 0.029 + 0.30) : 0;
      const fastFee = tx.metadata?.fee_amount || 0;
      return { ...tx, user_name: user?.name, user_email: user?.email, stripeFee, fastFee };
    }) || [];

    const csvHeader = 'ID,User ID,User Name,User Email,Type,Amount,Description,Direction,Stripe Fee,Fast Fee,Created At\n';
    const csvRows = transactions.map((tx: any) => 
      `"${tx.id}","${tx.user_id}","${tx.user_name || ''}","${tx.user_email || ''}","${tx.type}","${tx.amount}","${tx.description || ''}","${tx.direction}","${tx.stripeFee || 0}","${tx.fastFee || 0}","${tx.created_at}"`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=spline-transactions-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csvHeader + csvRows);
  } catch (error: any) {
    console.error('Export error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ======== WITHDRAWAL TRACKING ========
// Get all pending withdrawal requests with user details for manual processing
router.get('/withdrawals', adminAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const status = req.query.status as string || 'all'; // pending, processing, completed, failed, all
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Query withdrawal transactions
    let query = supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('type', 'withdrawal');

    // Filter by status if specified
    if (status !== 'all') {
      query = query.eq('metadata->>status', status);
    }

    const { data: withdrawals, error: wError, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (wError) {
      return res.status(500).json({ error: wError.message });
    }

    // Get user and wallet info for each withdrawal
    const userIds = [...new Set(withdrawals?.map(w => w.user_id) || [])];
    
    const [usersResult, walletsResult] = await Promise.all([
      supabaseAdmin
        .from('users')
        .select('id, unique_id, name, email, phone')
        .in('id', userIds),
      supabaseAdmin
        .from('wallets')
        .select('user_id, bank_details')
        .in('user_id', userIds)
    ]);

    const userMap = new Map(usersResult.data?.map(u => [u.id, u]) || []);
    const walletMap = new Map(walletsResult.data?.map(w => [w.user_id, w]) || []);

    // Build detailed withdrawal records
    const withdrawalRecords = withdrawals?.map(w => {
      const user = userMap.get(w.user_id);
      const wallet = walletMap.get(w.user_id);
      const metadata = w.metadata || {};
      
      const amount = Number(w.amount);
      const withdrawalType = metadata.withdrawal_type || 'normal';
      const feeAmount = metadata.fee_amount || 0;
      const feePercentage = withdrawalType === 'fast' ? 0.02 : 0;
      
      // Net amount = what admin needs to transfer to user's bank
      // For fast transfer: user requested $X, fee is included, so net = X - fee
      // For normal transfer: no fee, net = X
      const netAmount = withdrawalType === 'fast' ? amount - feeAmount : amount;
      
      return {
        transaction_id: w.id,
        created_at: w.created_at,
        status: metadata.status || 'pending',
        
        // User info
        user_id: w.user_id,
        user_unique_id: user?.unique_id || '',
        user_name: user?.name || 'Unknown',
        user_email: user?.email || '',
        user_phone: user?.phone || 'Not provided',
        
        // Withdrawal details
        withdrawal_type: withdrawalType,
        amount_requested: amount,
        fee_percentage: feePercentage * 100,
        fee_amount: feeAmount,
        net_amount_to_transfer: netAmount,
        
        // Bank details
        bank_name: wallet?.bank_details?.bank_name || 'Unknown',
        account_last4: wallet?.bank_details?.account_last4 || '****',
        account_type: wallet?.bank_details?.account_type || 'Unknown',
        is_demo_bank: wallet?.bank_details?.is_demo || false,
        
        // Estimated arrival
        estimated_arrival: metadata.estimated_arrival || 'Not specified',
        
        // Description
        description: w.description
      };
    }) || [];

    res.json({
      withdrawals: withdrawalRecords,
      total_count: count || 0,
      pending_count: withdrawalRecords.filter(w => w.status === 'pending').length,
      processing_count: withdrawalRecords.filter(w => w.status === 'processing').length
    });
  } catch (error: any) {
    console.error('Withdrawals fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update withdrawal status (e.g., mark as processing, completed, or failed)
router.patch('/withdrawals/:transactionId', adminAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { transactionId } = req.params;
    const { status, note } = req.body;

    if (!['pending', 'processing', 'completed', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be pending, processing, completed, or failed' });
    }

    // Get current transaction
    const { data: currentTx, error: fetchError } = await supabaseAdmin
      .from('transactions')
      .select('metadata')
      .eq('id', transactionId)
      .eq('type', 'withdrawal')
      .single();

    if (fetchError || !currentTx) {
      return res.status(404).json({ error: 'Withdrawal transaction not found' });
    }

    // Update metadata with new status
    const updatedMetadata = {
      ...currentTx.metadata,
      status,
      updated_at: new Date().toISOString(),
      updated_by: req.adminUser?.email,
      admin_note: note || currentTx.metadata?.admin_note
    };

    const { error: updateError } = await supabaseAdmin
      .from('transactions')
      .update({ metadata: updatedMetadata })
      .eq('id', transactionId);

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    res.json({ success: true, status, message: `Withdrawal marked as ${status}` });
  } catch (error: any) {
    console.error('Withdrawal update error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
