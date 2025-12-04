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

// Create admin client with explicit db schema options
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || '', {
  db: {
    schema: 'public'
  },
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

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
    console.log('Checking admin role for email:', email.toLowerCase());
    
    const freshClient = createClient(supabaseUrl, supabaseServiceKey || '', {
      db: { schema: 'public' },
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    const { data, error } = await freshClient
      .from('admin_roles')
      .select('role, name, email')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    
    console.log('Admin role check result:', { data, error: error?.message });
    
    if (error) {
      console.error('Admin role check error:', error.message);
      return { authorized: false };
    }
    
    if (!data) {
      console.log('No admin role found for email:', email.toLowerCase());
      const { data: allRoles } = await freshClient.from('admin_roles').select('email');
      console.log('All admin emails in database:', allRoles?.map(r => r.email));
      return { authorized: false };
    }
    
    console.log('Admin role found:', data);
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
    // Create fresh client for metrics (to ensure clean state)
    const metricsClient = createClient(supabaseUrl, supabaseServiceKey || '', {
      db: { schema: 'public' },
      auth: { autoRefreshToken: false, persistSession: false }
    });
    
    // Get total wallet liabilities (sum of all wallet balances)
    const { data: walletData, error: walletError } = await metricsClient
      .from('wallets')
      .select('balance, user_id');
    
    if (walletError) {
      console.error('Wallet query error:', walletError);
      return res.status(500).json({ error: walletError.message });
    }

    const totalLiabilities = walletData?.reduce((sum, w) => sum + Number(w.balance || 0), 0) || 0;
    const activeWalletCount = walletData?.filter(w => Number(w.balance || 0) > 0).length || 0;

    // Get transaction totals
    const { data: txData, error: txError } = await metricsClient
      .from('transactions')
      .select('type, amount, metadata, created_at, description, user_id');
    
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
    let cardPaymentVolume = 0;

    txData?.forEach(tx => {
      const amount = Number(tx.amount || 0);
      const createdAt = new Date(tx.created_at);

      if (tx.type === 'deposit') {
        totalDeposits += amount;
        depositTransactionCount++;
        if (createdAt >= thirtyDaysAgo) deposits30d += amount;
        if (createdAt >= sevenDaysAgo) deposits7d += amount;
      } else if (tx.type === 'card_charge') {
        // Card charges for split payments - external money coming into business
        totalDeposits += amount;
        cardPaymentTransactionCount++;
        cardPaymentVolume += amount;
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
        // Legacy: old card payments logged as split_payment
        cardPaymentTransactionCount++;
        cardPaymentVolume += amount;
      }
    });

    // Comprehensive Stripe Connect Marketplace Fee Model
    // Reference: https://docs.stripe.com/connect/marketplace
    // Note: card_charge transactions are already included in totalDeposits
    // So totalCardVolume = totalDeposits (not totalDeposits + cardPaymentVolume to avoid double-counting)
    const totalCardTransactions = depositTransactionCount + cardPaymentTransactionCount;
    const totalCardVolume = totalDeposits;
    
    // Base Stripe fees: 2.9% + 30c per transaction
    const stripeBasePercentageFee = totalCardVolume * 0.029;
    const stripeFixedFee = totalCardTransactions * 0.30;
    
    // Additional Stripe fees for NZ domestic-only operations:
    // International/cross-border/currency fees not applicable (NZ domestic only)
    const internationalCardFee = 0;
    const crossBorderFee = 0;
    const currencyConversionFee = 0;
    
    // Dispute/chargeback reserve: $15 per dispute (estimate 0.5% dispute rate)
    // Use floor to avoid overestimation when volume is low
    const disputeRate = 0.005;
    const estimatedDisputes = Math.floor(totalCardTransactions * disputeRate);
    const disputeFeeReserve = estimatedDisputes * 15;
    
    // 5. Refund fee retention: When refunds are issued, Stripe keeps the processing fee
    // Estimate 2% refund rate → we lose the Stripe fee on refunded transactions
    const refundRate = 0.02;
    const refundFeeLoss = totalCardVolume * refundRate * 0.029;
    
    // Total Stripe fees absorbed (base + additional risks)
    const stripeBaseFeesAbsorbed = stripeBasePercentageFee + stripeFixedFee;
    const stripeAdditionalFees = internationalCardFee + crossBorderFee + currencyConversionFee + disputeFeeReserve + refundFeeLoss;
    const stripeFeesAbsorbed = stripeBaseFeesAbsorbed + stripeAdditionalFees;
    
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
    let cardPaymentVolume = 0;

    txData?.forEach(tx => {
      const amount = Number(tx.amount || 0);
      const createdAt = new Date(tx.created_at);

      if (tx.type === 'deposit') {
        totalDeposits += amount;
        depositTransactionCount++;
      } else if (tx.type === 'card_charge') {
        // Card charges for split payments - external money coming into business
        totalDeposits += amount;
        cardPaymentTransactionCount++;
        cardPaymentVolume += amount;
      } else if (tx.type === 'withdrawal') {
        totalWithdrawals += amount;
        if (createdAt >= thirtyDaysAgo) withdrawals30d += amount;
        if (createdAt >= sevenDaysAgo) withdrawals7d += amount;
        
        if (tx.metadata?.withdrawal_type === 'fast' && tx.metadata?.fee_amount) {
          fastWithdrawalFeeRevenue += Number(tx.metadata.fee_amount);
        }
      } else if (tx.type === 'split_payment' && (tx.description as string)?.includes('from card')) {
        // Legacy: old card payments logged as split_payment
        cardPaymentTransactionCount++;
        cardPaymentVolume += amount;
      }
    });

    // Comprehensive Stripe Connect Marketplace Fee Model
    // Reference: https://docs.stripe.com/connect/marketplace
    // Note: card_charge transactions are already included in totalDeposits
    // So totalCardVolume = totalDeposits (not totalDeposits + cardPaymentVolume to avoid double-counting)
    const totalCardTransactions = depositTransactionCount + cardPaymentTransactionCount;
    const totalCardVolume = totalDeposits;
    
    // Base Stripe fees: 2.9% + 30c per transaction
    const stripeBasePercentageFee = totalCardVolume * 0.029;
    const stripeFixedFee = totalCardTransactions * 0.30;
    
    // Additional Stripe fees for NZ domestic-only operations:
    // International/cross-border/currency fees not applicable (NZ domestic only)
    const internationalCardFee = 0;
    const crossBorderFee = 0;
    const currencyConversionFee = 0;
    
    // Dispute/chargeback reserve: $15 per dispute (estimate 0.5% dispute rate)
    // Use floor to avoid overestimation when volume is low
    const disputeRate = 0.005;
    const estimatedDisputes = Math.floor(totalCardTransactions * disputeRate);
    const disputeFeeReserve = estimatedDisputes * 15;
    
    // 5. Refund fee retention: When refunds are issued, Stripe keeps the processing fee
    // Estimate 2% refund rate → we lose the Stripe fee on refunded transactions
    const refundRate = 0.02;
    const refundFeeLoss = totalCardVolume * refundRate * 0.029;
    
    // Total Stripe fees absorbed (base + additional risks)
    const stripeBaseFeesAbsorbed = stripeBasePercentageFee + stripeFixedFee;
    const stripeAdditionalFees = internationalCardFee + crossBorderFee + currencyConversionFee + disputeFeeReserve + refundFeeLoss;
    const stripeFeesAbsorbed = stripeBaseFeesAbsorbed + stripeAdditionalFees;

    // Net cash position = deposits received - Stripe fees paid - withdrawals sent out
    const netCashPosition = totalDeposits - stripeFeesAbsorbed - totalWithdrawals;

    // Buffer required = liabilities - cash position (what we need to cover shortfall)
    const bufferRequired = Math.max(0, totalLiabilities - netCashPosition);
    
    // Add operational safety margin (10% of liabilities as contingency)
    const safetyMargin = totalLiabilities * 0.10;
    const recommendedBuffer = bufferRequired + safetyMargin;

    // Calculate average daily withdrawals for projections
    const daysIn7d = 7;
    const daysIn30d = 30;
    const avgDaily7d = withdrawals7d / daysIn7d;
    const avgDaily30d = withdrawals30d / daysIn30d;

    // Projections based on current withdrawal patterns + safety margin
    const projection7d = recommendedBuffer + (avgDaily7d * 7);
    const projection30d = recommendedBuffer + (avgDaily30d * 30);

    // Determine status (more conservative thresholds)
    let status = 'healthy';
    let statusMessage = 'Cash position covers all liabilities with safety margin';
    
    if (bufferRequired > 0) {
      if (bufferRequired > totalLiabilities * 0.3) {
        status = 'critical';
        statusMessage = 'Significant buffer shortfall - immediate action required';
      } else if (bufferRequired > totalLiabilities * 0.05) {
        status = 'warning';
        statusMessage = 'Buffer shortfall detected - monitor closely';
      }
    } else if (netCashPosition < safetyMargin) {
      status = 'warning';
      statusMessage = 'Cash position below recommended safety margin';
    }

    res.json({
      total_liabilities: totalLiabilities,
      net_cash_position: netCashPosition,
      stripe_fees_paid: stripeFeesAbsorbed,
      stripe_base_fees: stripeBaseFeesAbsorbed,
      stripe_additional_fees: stripeAdditionalFees,
      fast_fee_revenue: fastWithdrawalFeeRevenue,
      buffer_required: bufferRequired,
      recommended_buffer: recommendedBuffer,
      safety_margin: safetyMargin,
      projection_7d: projection7d,
      projection_30d: projection30d,
      avg_daily_withdrawal_7d: avgDaily7d,
      avg_daily_withdrawal_30d: avgDaily30d,
      status,
      status_message: statusMessage,
      fee_breakdown: {
        base_percentage: stripeBasePercentageFee,
        fixed_per_transaction: stripeFixedFee,
        international_cards: internationalCardFee,
        cross_border: crossBorderFee,
        currency_conversion: currencyConversionFee,
        dispute_reserve: disputeFeeReserve,
        refund_loss: refundFeeLoss
      }
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

    // Use fresh client to avoid stale connection issues
    const freshClient = createClient(supabaseUrl, supabaseServiceKey || '', {
      db: { schema: 'public' },
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: txData, error: txError } = await freshClient
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
      
      if (tx.type === 'deposit' || tx.type === 'card_charge') {
        // Both deposits and card charges represent external money coming in
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

    res.json({ trends });
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

    // Use fresh client to avoid stale connection issues
    const freshClient = createClient(supabaseUrl, supabaseServiceKey || '', {
      db: { schema: 'public' },
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Build query
    let query = freshClient
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
    
    const { data: usersData } = await freshClient
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

    // Use fresh client to avoid stale connection issues
    const freshClient = createClient(supabaseUrl, supabaseServiceKey || '', {
      db: { schema: 'public' },
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Query withdrawal transactions
    let query = freshClient
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
      freshClient
        .from('users')
        .select('id, unique_id, name, email, phone')
        .in('id', userIds),
      freshClient
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
        
        // Bank details - FULL info for admin to process transfers
        bank_name: wallet?.bank_details?.bank_name || 'Unknown',
        account_number: wallet?.bank_details?.account_number || 'Not provided',
        account_holder_name: wallet?.bank_details?.account_holder_name || 'Not provided',
        account_last4: wallet?.bank_details?.account_last4 || '****',
        account_type: wallet?.bank_details?.account_type || 'Unknown',
        
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

// ======== REAL-TIME UPDATES VIA SERVER-SENT EVENTS ========
// Store active SSE connections for broadcasting updates
const sseClients: Set<express.Response> = new Set();

// Helper function to fetch all metrics data (reused from /metrics and /buffer)
async function fetchAllMetrics() {
  // Create fresh client to avoid connection state issues
  const client = createClient(supabaseUrl, supabaseServiceKey || '', {
    db: { schema: 'public' },
    auth: { autoRefreshToken: false, persistSession: false }
  });
  
  // Get wallet data
  const { data: walletData } = await client
    .from('wallets')
    .select('balance');
  
  const totalLiabilities = walletData?.reduce((sum, w) => sum + Number(w.balance || 0), 0) || 0;
  const activeWalletCount = walletData?.filter(w => Number(w.balance || 0) > 0).length || 0;

  // Get transaction data
  const { data: txData } = await client
    .from('transactions')
    .select('type, amount, metadata, created_at, description');

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
  let cardPaymentVolume = 0;

  txData?.forEach(tx => {
    const amount = Number(tx.amount || 0);
    const createdAt = new Date(tx.created_at);

    if (tx.type === 'deposit') {
      totalDeposits += amount;
      depositTransactionCount++;
      if (createdAt >= thirtyDaysAgo) deposits30d += amount;
      if (createdAt >= sevenDaysAgo) deposits7d += amount;
    } else if (tx.type === 'card_charge') {
      // Card charges for split payments - external money coming into business
      totalDeposits += amount;
      cardPaymentTransactionCount++;
      cardPaymentVolume += amount;
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
      // Legacy: old card payments logged as split_payment
      cardPaymentTransactionCount++;
      cardPaymentVolume += amount;
    }
  });

  // Stripe fee calculations
  // Note: card_charge transactions are already included in totalDeposits
  // So totalCardVolume = totalDeposits (not totalDeposits + cardPaymentVolume to avoid double-counting)
  const totalCardTransactions = depositTransactionCount + cardPaymentTransactionCount;
  const totalCardVolume = totalDeposits;
  const stripeBasePercentageFee = totalCardVolume * 0.029;
  const stripeFixedFee = totalCardTransactions * 0.30;
  const disputeRate = 0.005;
  const estimatedDisputes = Math.floor(totalCardTransactions * disputeRate);
  const disputeFeeReserve = estimatedDisputes * 15;
  const refundRate = 0.02;
  const refundFeeLoss = totalCardVolume * refundRate * 0.029;
  const stripeBaseFeesAbsorbed = stripeBasePercentageFee + stripeFixedFee;
  const stripeAdditionalFees = disputeFeeReserve + refundFeeLoss;
  const stripeFeesAbsorbed = stripeBaseFeesAbsorbed + stripeAdditionalFees;
  const netFeePosition = fastWithdrawalFeeRevenue - stripeFeesAbsorbed;

  // Buffer calculations
  const netCashPosition = totalDeposits - stripeFeesAbsorbed - totalWithdrawals;
  const bufferRequired = Math.max(0, totalLiabilities - netCashPosition);
  const safetyMargin = totalLiabilities * 0.10;
  const recommendedBuffer = bufferRequired + safetyMargin;
  const avgDaily7d = withdrawals7d / 7;
  const avgDaily30d = withdrawals30d / 30;
  const projection7d = recommendedBuffer + (avgDaily7d * 7);
  const projection30d = recommendedBuffer + (avgDaily30d * 30);

  let status = 'healthy';
  let statusMessage = 'Cash position covers all liabilities with safety margin';
  if (bufferRequired > 0) {
    if (bufferRequired > totalLiabilities * 0.3) {
      status = 'critical';
      statusMessage = 'Significant buffer shortfall - immediate action required';
    } else if (bufferRequired > totalLiabilities * 0.05) {
      status = 'warning';
      statusMessage = 'Buffer shortfall detected - monitor closely';
    }
  } else if (netCashPosition < safetyMargin) {
    status = 'warning';
    statusMessage = 'Cash position below recommended safety margin';
  }

  // Get pending withdrawal count
  const { count: pendingWithdrawals } = await client
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('type', 'withdrawal')
    .eq('metadata->>status', 'pending');

  return {
    metrics: {
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
    },
    buffer: {
      total_liabilities: totalLiabilities,
      net_cash_position: netCashPosition,
      stripe_fees_paid: stripeFeesAbsorbed,
      stripe_base_fees: stripeBaseFeesAbsorbed,
      stripe_additional_fees: stripeAdditionalFees,
      fast_fee_revenue: fastWithdrawalFeeRevenue,
      buffer_required: bufferRequired,
      recommended_buffer: recommendedBuffer,
      safety_margin: safetyMargin,
      projection_7d: projection7d,
      projection_30d: projection30d,
      avg_daily_withdrawal_7d: avgDaily7d,
      avg_daily_withdrawal_30d: avgDaily30d,
      status,
      status_message: statusMessage,
      fee_breakdown: {
        base_percentage: stripeBasePercentageFee,
        fixed_per_transaction: stripeFixedFee,
        international_cards: 0,
        cross_border: 0,
        currency_conversion: 0,
        dispute_reserve: disputeFeeReserve,
        refund_loss: refundFeeLoss
      }
    },
    pending_withdrawals: pendingWithdrawals || 0,
    timestamp: new Date().toISOString()
  };
}

// SSE endpoint for real-time updates
// Note: EventSource doesn't support custom headers, so we accept token via query param
router.get('/stream', async (req: express.Request, res: express.Response) => {
  // Manual auth since EventSource can't send headers
  const token = req.query.token as string;
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const user = await verifyAuthToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  const adminCheck = await checkAdminRole(user.email);
  if (!adminCheck.authorized) {
    return res.status(403).json({ error: 'Admin access denied' });
  }
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  
  // Add client to active connections
  sseClients.add(res);
  console.log(`SSE client connected. Total clients: ${sseClients.size}`);
  
  // Send initial data immediately
  try {
    const data = await fetchAllMetrics();
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch (err) {
    console.error('Error sending initial SSE data:', err);
  }

  // Send heartbeat every 30 seconds to keep connection alive
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(`:heartbeat\n\n`);
    } catch (err) {
      clearInterval(heartbeatInterval);
    }
  }, 30000);

  // Send updates every 5 seconds
  const updateInterval = setInterval(async () => {
    try {
      const data = await fetchAllMetrics();
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      console.error('Error sending SSE update:', err);
    }
  }, 5000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    clearInterval(updateInterval);
    sseClients.delete(res);
    console.log(`SSE client disconnected. Total clients: ${sseClients.size}`);
  });
});

// Export function to broadcast updates to all connected clients
export async function broadcastMetricsUpdate() {
  if (sseClients.size === 0) return;
  
  try {
    const data = await fetchAllMetrics();
    const message = `data: ${JSON.stringify(data)}\n\n`;
    
    sseClients.forEach(client => {
      try {
        client.write(message);
      } catch (err) {
        sseClients.delete(client);
      }
    });
  } catch (err) {
    console.error('Error broadcasting metrics update:', err);
  }
}

// ======== GAMIFICATION ENDPOINTS ========

// Get all users with their gamification stats
router.get('/gamification/users', adminAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { sortBy = 'current_level', order = 'desc', page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 50, 100);
    const offset = (pageNum - 1) * limitNum;

    const freshClient = createClient(supabaseUrl, supabaseServiceKey || '', {
      db: { schema: 'public' },
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get users with gamification data joined
    const { data: users, error: usersError, count } = await freshClient
      .from('users')
      .select(`
        id,
        email,
        first_name,
        last_name,
        unique_id,
        created_at,
        user_gamification (
          current_level,
          total_xp,
          splits_paid,
          splits_created,
          current_streak,
          longest_streak,
          friends_referred,
          total_completed_splits
        )
      `, { count: 'exact' })
      .range(offset, offset + limitNum - 1);

    if (usersError) {
      console.error('Gamification users fetch error:', usersError);
      return res.status(500).json({ error: usersError.message });
    }

    // Transform and sort the data
    const transformedUsers = (users || []).map(u => {
      const gam = Array.isArray(u.user_gamification) ? u.user_gamification[0] : u.user_gamification;
      return {
        id: u.id,
        email: u.email,
        name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Unknown',
        unique_id: u.unique_id,
        joined: u.created_at,
        current_level: gam?.current_level || 1,
        total_xp: gam?.total_xp || 0,
        splits_paid: gam?.splits_paid || 0,
        splits_created: gam?.splits_created || 0,
        current_streak: gam?.current_streak || 0,
        longest_streak: gam?.longest_streak || 0,
        friends_referred: gam?.friends_referred || 0,
        total_completed_splits: gam?.total_completed_splits || 0
      };
    });

    // Sort locally (Supabase can't sort on joined table columns directly)
    const validSortFields = ['current_level', 'total_xp', 'splits_paid', 'splits_created', 'current_streak', 'joined'];
    const sortField = validSortFields.includes(sortBy as string) ? sortBy as string : 'current_level';
    const sortOrder = order === 'asc' ? 1 : -1;

    transformedUsers.sort((a: any, b: any) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * sortOrder;
      }
      return String(aVal).localeCompare(String(bVal)) * sortOrder;
    });

    res.json({
      users: transformedUsers,
      total_count: count || 0,
      page: pageNum,
      limit: limitNum,
      total_pages: Math.ceil((count || 0) / limitNum)
    });
  } catch (error: any) {
    console.error('Gamification users error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get gamification summary statistics
router.get('/gamification/stats', adminAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const freshClient = createClient(supabaseUrl, supabaseServiceKey || '', {
      db: { schema: 'public' },
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get all gamification profiles
    const { data: profiles, error: profilesError } = await freshClient
      .from('user_gamification')
      .select('current_level, total_xp, splits_paid, splits_created, current_streak, longest_streak');

    if (profilesError) {
      console.error('Gamification stats fetch error:', profilesError);
      return res.status(500).json({ error: profilesError.message });
    }

    // Calculate level distribution
    const levelDistribution: Record<number, number> = {};
    let totalXP = 0;
    let totalSplitsPaid = 0;
    let totalSplitsCreated = 0;
    let activeStreaks = 0;
    let longestStreak = 0;

    (profiles || []).forEach(p => {
      const level = p.current_level || 1;
      levelDistribution[level] = (levelDistribution[level] || 0) + 1;
      totalXP += p.total_xp || 0;
      totalSplitsPaid += p.splits_paid || 0;
      totalSplitsCreated += p.splits_created || 0;
      if ((p.current_streak || 0) > 0) activeStreaks++;
      if ((p.longest_streak || 0) > longestStreak) longestStreak = p.longest_streak;
    });

    const totalUsers = profiles?.length || 0;
    const avgLevel = totalUsers > 0 
      ? (profiles || []).reduce((sum, p) => sum + (p.current_level || 1), 0) / totalUsers 
      : 1;
    const avgXP = totalUsers > 0 ? totalXP / totalUsers : 0;

    // Get XP history for recent activity
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentXP, error: recentXPError } = await freshClient
      .from('xp_history')
      .select('xp_amount, created_at')
      .gte('created_at', sevenDaysAgo);

    const xpAwarded7d = (recentXP || []).reduce((sum, x) => sum + (x.xp_amount || 0), 0);

    // Get badges statistics
    const { data: badges, error: badgesError } = await freshClient
      .from('user_badges')
      .select('badge_id');

    const badgeCounts: Record<string, number> = {};
    (badges || []).forEach(b => {
      badgeCounts[b.badge_id] = (badgeCounts[b.badge_id] || 0) + 1;
    });

    res.json({
      total_users_with_gamification: totalUsers,
      average_level: Math.round(avgLevel * 100) / 100,
      average_xp: Math.round(avgXP),
      total_xp_in_system: totalXP,
      xp_awarded_7days: xpAwarded7d,
      total_splits_paid: totalSplitsPaid,
      total_splits_created: totalSplitsCreated,
      users_with_active_streaks: activeStreaks,
      longest_streak_ever: longestStreak,
      level_distribution: levelDistribution,
      badge_distribution: badgeCounts
    });
  } catch (error: any) {
    console.error('Gamification stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get XP history for a specific user
router.get('/gamification/users/:userId/xp-history', adminAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const { limit = '50' } = req.query;

    const freshClient = createClient(supabaseUrl, supabaseServiceKey || '', {
      db: { schema: 'public' },
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: history, error: historyError } = await freshClient
      .from('xp_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string) || 50);

    if (historyError) {
      return res.status(500).json({ error: historyError.message });
    }

    res.json({ xp_history: history || [] });
  } catch (error: any) {
    console.error('XP history fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get badges for a specific user
router.get('/gamification/users/:userId/badges', adminAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;

    const freshClient = createClient(supabaseUrl, supabaseServiceKey || '', {
      db: { schema: 'public' },
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: badges, error: badgesError } = await freshClient
      .from('user_badges')
      .select('*')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });

    if (badgesError) {
      return res.status(500).json({ error: badgesError.message });
    }

    res.json({ badges: badges || [] });
  } catch (error: any) {
    console.error('Badges fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manually award XP to a user (admin tool)
router.post('/gamification/users/:userId/award-xp', adminAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const { xp_amount, reason } = req.body;

    if (!xp_amount || typeof xp_amount !== 'number' || xp_amount <= 0) {
      return res.status(400).json({ error: 'Invalid XP amount' });
    }

    if (!reason) {
      return res.status(400).json({ error: 'Reason is required' });
    }

    const freshClient = createClient(supabaseUrl, supabaseServiceKey || '', {
      db: { schema: 'public' },
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get current gamification profile
    const { data: profile, error: profileError } = await freshClient
      .from('user_gamification')
      .select('current_level, total_xp')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      return res.status(404).json({ error: 'User gamification profile not found' });
    }

    const newTotalXP = (profile.total_xp || 0) + xp_amount;
    
    // Calculate new level based on XP
    const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2100, 2800];
    let newLevel = 1;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (newTotalXP >= LEVEL_THRESHOLDS[i]) {
        newLevel = i + 1;
        break;
      }
    }

    // Update profile
    const { error: updateError } = await freshClient
      .from('user_gamification')
      .update({
        total_xp: newTotalXP,
        current_level: newLevel,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    // Log XP history
    await freshClient
      .from('xp_history')
      .insert({
        user_id: userId,
        action_type: 'admin_award',
        xp_amount: xp_amount,
        description: `Admin award: ${reason}`,
        metadata: {
          awarded_by: req.adminUser?.email,
          reason
        }
      });

    res.json({
      success: true,
      message: `Awarded ${xp_amount} XP to user`,
      new_total_xp: newTotalXP,
      new_level: newLevel,
      leveled_up: newLevel > (profile.current_level || 1)
    });
  } catch (error: any) {
    console.error('XP award error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
