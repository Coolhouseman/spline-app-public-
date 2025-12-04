import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import blinkpayRouter from './routes/blinkpay.routes';
import notificationsRouter from './routes/notifications.routes';
import twilioRouter from './routes/twilio.routes';
import adminRouter from './routes/admin.routes';
import stripeRouter from './routes/stripe.routes';
import gamificationRouter from './routes/gamification.routes';
import { DailyReminderService } from './services/dailyReminder.service';
import { sendWithdrawalNotification } from './services/email.service';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '8081', 10);

app.use(cors());
app.use(express.json());

app.use('/admin', express.static(path.join(__dirname, 'public/admin')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.sendFile(path.join(__dirname, 'public/robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml');
  res.sendFile(path.join(__dirname, 'public/sitemap.xml'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/terms', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/terms.html'));
});

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/privacy.html'));
});

app.get('/card-setup.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/card-setup.html'));
});

// Import Supabase for server-side password operations
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://vhicohutiocnfjwsofhy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);

// API endpoint for password reset - uses service role key server-side
app.post('/api/reset-password', async (req, res) => {
  try {
    const { token_hash, type, new_password } = req.body;
    
    if (!token_hash || !new_password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    // First verify the OTP to get the user
    const { data: verifyData, error: verifyError } = await supabaseServer.auth.verifyOtp({
      token_hash,
      type: type || 'recovery'
    });
    
    if (verifyError) {
      console.error('Token verification error:', verifyError);
      return res.status(400).json({ error: 'Invalid or expired reset link', details: verifyError.message });
    }
    
    if (!verifyData.user) {
      return res.status(400).json({ error: 'Could not verify user' });
    }
    
    // Update the user's password using admin API
    const { error: updateError } = await supabaseServer.auth.admin.updateUserById(
      verifyData.user.id,
      { password: new_password }
    );
    
    if (updateError) {
      console.error('Password update error:', updateError);
      return res.status(500).json({ error: 'Failed to update password', details: updateError.message });
    }
    
    console.log('Password updated successfully for user:', verifyData.user.email);
    res.json({ success: true, message: 'Password updated successfully' });
    
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

// API endpoint for requesting password reset email
app.post('/api/request-password-reset', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const { error } = await supabaseServer.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://splinepay.replit.app/reset-password'
    });
    
    if (error) {
      console.error('Password reset request error:', error);
      return res.status(500).json({ error: 'Failed to send reset email' });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Password reset request error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

// API endpoint for withdrawal notification emails (internal service endpoint)
// Protected by a simple service key to prevent unauthorized access from external sources
app.post('/api/notify-withdrawal', async (req, res) => {
  try {
    // Validate service key to prevent unauthorized access
    // The mobile app uses 'spline-internal-service' as a shared key
    const serviceKey = req.headers['x-service-key'];
    const validKeys = ['spline-internal-service', process.env.SESSION_SECRET].filter(Boolean);
    
    if (!serviceKey || !validKeys.includes(serviceKey as string)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const {
      userId,
      userDatabaseId,
      userName,
      userEmail,
      userPhone,
      amount,
      feeAmount,
      netAmount,
      withdrawalType,
      bankName,
      accountNumber,
      accountHolderName,
      accountLast4,
      estimatedArrival,
      transactionId,
      remainingBalance
    } = req.body;

    if (!transactionId || !userId || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const success = await sendWithdrawalNotification({
      userId,
      userDatabaseId: userDatabaseId || 'N/A',
      userName: userName || 'Unknown User',
      userEmail: userEmail || 'N/A',
      userPhone: userPhone || 'N/A',
      amount: parseFloat(amount) || 0,
      feeAmount: parseFloat(feeAmount) || 0,
      netAmount: parseFloat(netAmount) || 0,
      withdrawalType: withdrawalType || 'normal',
      bankName: bankName || 'Unknown Bank',
      accountNumber: accountNumber || 'Not provided',
      accountHolderName: accountHolderName || 'Not provided',
      accountLast4: accountLast4 || '****',
      estimatedArrival: estimatedArrival || 'Not specified',
      transactionId,
      remainingBalance: parseFloat(remainingBalance) || 0
    });

    res.json({ success, message: success ? 'Notification sent' : 'Notification logged (email not configured)' });
  } catch (error: any) {
    console.error('Withdrawal notification error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

app.get('/reset-password', (req, res) => {
  // Use the known Supabase credentials (anon key is meant to be public)
  const supabaseUrl = 'https://vhicohutiocnfjwsofhy.supabase.co';
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoaWNvaHV0aW9jbmZqd3NvZmh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NTQ2NjksImV4cCI6MjA3OTUzMDY2OX0.KJuLMgwy2Dfu5amY0VN4KfPemfsJcRB3EI0AxZQpOb8';
  
  // Get token from query params (some email clients pass it there)
  const tokenFromQuery = req.query.token || req.query.access_token || '';
  const typeFromQuery = req.query.type || '';
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password - Spline</title>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 24px;
      padding: 48px 32px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }
    .logo {
      font-size: 48px;
      font-weight: 800;
      margin-bottom: 24px;
    }
    .logo-sp { color: #3B82F6; }
    .logo-line { color: #1f2937; text-decoration: underline; text-decoration-color: #3B82F6; text-underline-offset: 4px; }
    .logo::after { content: '.'; color: #3B82F6; }
    h1 {
      font-size: 24px;
      color: #1f2937;
      margin-bottom: 8px;
    }
    .subtitle {
      color: #6b7280;
      font-size: 14px;
      margin-bottom: 24px;
    }
    .form-group {
      margin-bottom: 16px;
      text-align: left;
    }
    .form-group label {
      display: block;
      color: #374151;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 6px;
    }
    .form-group input {
      width: 100%;
      padding: 14px 16px;
      border: 1px solid #d1d5db;
      border-radius: 12px;
      font-size: 16px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .form-group input:focus {
      outline: none;
      border-color: #3B82F6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    .btn {
      display: block;
      width: 100%;
      background: #3B82F6;
      color: white;
      padding: 16px 32px;
      border: none;
      border-radius: 12px;
      font-weight: 600;
      font-size: 16px;
      cursor: pointer;
      transition: background 0.2s;
      margin-top: 8px;
    }
    .btn:hover { background: #2563eb; }
    .btn:disabled { background: #9ca3af; cursor: not-allowed; }
    .btn-secondary {
      background: transparent;
      color: #3B82F6;
      border: 2px solid #3B82F6;
      margin-top: 12px;
    }
    .btn-secondary:hover { background: rgba(59, 130, 246, 0.1); }
    .error {
      background: #fef2f2;
      color: #dc2626;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 16px;
      display: none;
    }
    .success {
      background: #f0fdf4;
      color: #16a34a;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 16px;
      display: none;
    }
    .divider {
      display: flex;
      align-items: center;
      margin: 24px 0;
      color: #9ca3af;
      font-size: 14px;
    }
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #e5e7eb;
    }
    .divider span { padding: 0 16px; }
    .app-link {
      color: #6b7280;
      font-size: 14px;
      margin-top: 16px;
    }
    .app-link a { color: #3B82F6; text-decoration: none; font-weight: 500; }
    .password-requirements {
      text-align: left;
      font-size: 12px;
      color: #6b7280;
      margin-top: 8px;
    }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo"><span class="logo-sp">Sp</span><span class="logo-line">line</span></div>
    
    <div id="loading-view">
      <h1>Verifying Link...</h1>
      <p class="subtitle">Please wait while we verify your reset link</p>
      <div style="margin: 24px 0;">
        <div style="width: 40px; height: 40px; border: 3px solid #e5e7eb; border-top-color: #3B82F6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
      </div>
      <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
    </div>
    
    <div id="confirm-view" class="hidden">
      <h1>Verify Your Identity</h1>
      <p class="subtitle">Click the button below to verify your reset link and set a new password.</p>
      
      <div id="confirm-error" class="error"></div>
      
      <button onclick="handleVerifyToken()" class="btn" id="verifyBtn">
        Verify & Continue
      </button>
      
      <p class="app-link" style="margin-top: 24px;">
        <a href="/">Return to Homepage</a>
      </p>
    </div>
    
    <div id="reset-form" class="hidden">
      <h1>Reset Your Password</h1>
      <p class="subtitle">Enter your new password below</p>
      
      <div id="error" class="error"></div>
      <div id="success" class="success"></div>
      
      <form onsubmit="handleSubmit(event)">
        <div class="form-group">
          <label for="password">New Password</label>
          <input type="password" id="password" placeholder="Enter new password" required minlength="8">
          <p class="password-requirements">Must be at least 8 characters</p>
        </div>
        
        <div class="form-group">
          <label for="confirmPassword">Confirm Password</label>
          <input type="password" id="confirmPassword" placeholder="Confirm new password" required>
        </div>
        
        <button type="submit" class="btn" id="submitBtn">Update Password</button>
      </form>
    </div>
    
    <div id="expired-view" class="hidden">
      <h1>Link Expired</h1>
      <p class="subtitle">This reset link has expired or is invalid. Request a new one below.</p>
      
      <div id="expired-error" class="error"></div>
      <div id="expired-success" class="success"></div>
      
      <form onsubmit="handleResendRequest(event)">
        <div class="form-group">
          <label for="email">Email Address</label>
          <input type="email" id="email" placeholder="Enter your email" required>
        </div>
        
        <button type="submit" class="btn" id="resendBtn">Send New Reset Link</button>
      </form>
      
      <p class="app-link" style="margin-top: 24px;">
        <a href="/">Return to Homepage</a>
      </p>
    </div>
    
    <div id="success-view" class="hidden">
      <div style="font-size: 64px; margin-bottom: 24px; color: #16a34a;">&#10003;</div>
      <h1>Password Updated!</h1>
      <p class="subtitle">Your password has been successfully reset. You can now log in with your new password.</p>
      <a href="/" class="btn" style="display: block; text-decoration: none; margin-top: 24px;">
        Return to Homepage
      </a>
    </div>
    
    <div id="email-sent-view" class="hidden">
      <div style="font-size: 64px; margin-bottom: 24px;">&#9993;</div>
      <h1>Check Your Email</h1>
      <p class="subtitle">We've sent a new password reset link to your email address. Please check your inbox and click the link.</p>
      <a href="/" class="btn" style="display: block; text-decoration: none; margin-top: 24px;">
        Return to Homepage
      </a>
    </div>
  </div>

  <script>
    const SUPABASE_URL = '${supabaseUrl}';
    const SUPABASE_ANON_KEY = '${supabaseAnonKey}';
    
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    let sessionReady = false;
    
    function showView(viewId) {
      ['loading-view', 'confirm-view', 'reset-form', 'expired-view', 'success-view', 'email-sent-view'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
      });
      document.getElementById(viewId).classList.remove('hidden');
    }
    
    // Store token_hash for verification
    let pendingTokenHash = null;
    let pendingTokenType = null;
    
    function showError(message, elementId = 'error') {
      const errorEl = document.getElementById(elementId);
      if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
      }
    }
    
    function hideError(elementId = 'error') {
      const errorEl = document.getElementById(elementId);
      if (errorEl) {
        errorEl.style.display = 'none';
      }
    }
    
    // Listen for auth state changes - most reliable method
    supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event, session ? 'with session' : 'no session');
      
      if (event === 'PASSWORD_RECOVERY') {
        sessionReady = true;
        showView('reset-form');
        console.log('Password recovery session established');
      } else if (event === 'SIGNED_IN' && session) {
        sessionReady = true;
        showView('reset-form');
        console.log('Session established via SIGNED_IN');
      }
    });
    
    async function initSession() {
      console.log('Full URL:', window.location.href);
      console.log('Hash:', window.location.hash);
      console.log('Search:', window.location.search);
      
      // Check for token_hash in URL (from custom email template)
      const urlParams = new URLSearchParams(window.location.search);
      const tokenHash = urlParams.get('token_hash');
      const tokenType = urlParams.get('type') || 'recovery';
      
      if (tokenHash) {
        console.log('Found token_hash in URL, showing confirm view');
        pendingTokenHash = tokenHash;
        pendingTokenType = tokenType;
        showView('confirm-view');
        return;
      }
      
      // Give Supabase time to process the URL hash (for standard flow)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if session was established via onAuthStateChange
      if (sessionReady) {
        return;
      }
      
      // Check for existing session
      const { data: { session }, error } = await supabase.auth.getSession();
      console.log('Session check:', session ? 'found' : 'not found', error || '');
      
      if (session) {
        sessionReady = true;
        showView('reset-form');
        return;
      }
      
      // Wait a bit more then show expired view
      setTimeout(() => {
        if (!sessionReady) {
          console.log('No session established, showing expired view');
          showView('expired-view');
        }
      }, 1500);
    }
    
    async function handleVerifyToken() {
      const verifyBtn = document.getElementById('verifyBtn');
      verifyBtn.disabled = true;
      verifyBtn.textContent = 'Verifying...';
      
      hideError('confirm-error');
      
      try {
        if (!pendingTokenHash) {
          showError('No verification token found.', 'confirm-error');
          verifyBtn.disabled = false;
          verifyBtn.textContent = 'Verify & Continue';
          return;
        }
        
        // Token will be verified server-side when password is submitted
        // Just show the form for now
        console.log('Token found, showing password form');
        sessionReady = true;
        showView('reset-form');
        
      } catch (err) {
        console.error('Verification error:', err);
        showError('An error occurred. Please try again.', 'confirm-error');
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Verify & Continue';
      }
    }
    
    initSession();
    
    async function handleResendRequest(e) {
      e.preventDefault();
      
      const email = document.getElementById('email').value;
      const resendBtn = document.getElementById('resendBtn');
      
      hideError('expired-error');
      resendBtn.disabled = true;
      resendBtn.textContent = 'Sending...';
      
      try {
        // Use server-side API to send reset email
        const response = await fetch('/api/request-password-reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          showError(result.error || 'Failed to send reset email', 'expired-error');
          resendBtn.disabled = false;
          resendBtn.textContent = 'Send New Reset Link';
          return;
        }
        
        showView('email-sent-view');
      } catch (err) {
        showError('An error occurred. Please try again.', 'expired-error');
        resendBtn.disabled = false;
        resendBtn.textContent = 'Send New Reset Link';
      }
    }
    
    async function handleSubmit(e) {
      e.preventDefault();
      
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const submitBtn = document.getElementById('submitBtn');
      
      // Hide previous messages
      document.getElementById('error').style.display = 'none';
      document.getElementById('success').style.display = 'none';
      
      // Validate passwords match
      if (password !== confirmPassword) {
        showError('Passwords do not match');
        return;
      }
      
      // Validate password length
      if (password.length < 8) {
        showError('Password must be at least 8 characters');
        return;
      }
      
      if (!pendingTokenHash) {
        showError('Reset link is invalid. Please request a new password reset.');
        return;
      }
      
      submitBtn.disabled = true;
      submitBtn.textContent = 'Updating...';
      
      try {
        // Use server-side API to update password
        const response = await fetch('/api/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token_hash: pendingTokenHash,
            type: pendingTokenType,
            new_password: password
          })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          showError(result.error || 'Failed to update password');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Update Password';
          
          // If token expired, show expired view
          if (result.error && result.error.includes('expired')) {
            setTimeout(() => showView('expired-view'), 2000);
          }
          return;
        }
        
        // Show success view
        showView('success-view');
        
      } catch (err) {
        console.error('Password update error:', err);
        showError('An unexpected error occurred. Please try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update Password';
      }
    }
  </script>
</body>
</html>`;
  
  res.type('html').send(html);
});

// API endpoint for account deletion - requires authenticated user
app.delete('/api/delete-account', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Verify the user token
    const { data: authData, error: authError } = await supabaseServer.auth.getUser(token);
    
    if (authError || !authData.user) {
      console.error('Token verification failed:', authError?.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    const userId = authData.user.id;
    const userEmail = authData.user.email;
    
    console.log(`Account deletion requested for user: ${userEmail} (${userId})`);
    
    // Track deletion errors to ensure complete data removal
    const deletionErrors: string[] = [];
    
    // Delete user data in order (respecting foreign key constraints)
    // 1. Delete notifications
    const { error: notifError } = await supabaseServer
      .from('notifications')
      .delete()
      .eq('user_id', userId);
    if (notifError && notifError.code !== 'PGRST116') {
      console.error('Notifications delete error:', notifError.message);
      deletionErrors.push(`notifications: ${notifError.message}`);
    }
    
    // 2. Delete split participants where user is participant
    const { error: participantError } = await supabaseServer
      .from('split_participants')
      .delete()
      .eq('user_id', userId);
    if (participantError && participantError.code !== 'PGRST116') {
      console.error('Split participants delete error:', participantError.message);
      deletionErrors.push(`split_participants: ${participantError.message}`);
    }
    
    // 3. Delete split events created by user
    const { error: splitsError } = await supabaseServer
      .from('split_events')
      .delete()
      .eq('creator_id', userId);
    if (splitsError && splitsError.code !== 'PGRST116') {
      console.error('Split events delete error:', splitsError.message);
      deletionErrors.push(`split_events: ${splitsError.message}`);
    }
    
    // 4. Delete friend relationships (both directions)
    const { error: friendsError1 } = await supabaseServer
      .from('friends')
      .delete()
      .eq('user_id', userId);
    if (friendsError1 && friendsError1.code !== 'PGRST116') {
      console.error('Friends (user_id) delete error:', friendsError1.message);
      deletionErrors.push(`friends_user: ${friendsError1.message}`);
    }
    
    const { error: friendsError2 } = await supabaseServer
      .from('friends')
      .delete()
      .eq('friend_id', userId);
    if (friendsError2 && friendsError2.code !== 'PGRST116') {
      console.error('Friends (friend_id) delete error:', friendsError2.message);
      deletionErrors.push(`friends_friend: ${friendsError2.message}`);
    }
    
    // 5. Delete transactions
    const { error: txError } = await supabaseServer
      .from('transactions')
      .delete()
      .eq('user_id', userId);
    if (txError && txError.code !== 'PGRST116') {
      console.error('Transactions delete error:', txError.message);
      deletionErrors.push(`transactions: ${txError.message}`);
    }
    
    // 6. Delete wallet
    const { error: walletError } = await supabaseServer
      .from('wallets')
      .delete()
      .eq('user_id', userId);
    if (walletError && walletError.code !== 'PGRST116') {
      console.error('Wallet delete error:', walletError.message);
      deletionErrors.push(`wallet: ${walletError.message}`);
    }
    
    // 7. Delete user profile
    const { error: profileError } = await supabaseServer
      .from('users')
      .delete()
      .eq('id', userId);
    if (profileError && profileError.code !== 'PGRST116') {
      console.error('User profile delete error:', profileError.message);
      deletionErrors.push(`user_profile: ${profileError.message}`);
    }
    
    // Check if critical data deletion failed (wallet and user profile are critical)
    if (deletionErrors.some(e => e.includes('wallet:') || e.includes('user_profile:'))) {
      console.error('Critical deletion errors:', deletionErrors);
      return res.status(500).json({ 
        error: 'Failed to delete account data. Please contact support.',
        details: deletionErrors 
      });
    }
    
    // 8. Delete auth user (this is the final step - only proceed if data was deleted)
    const { error: authDeleteError } = await supabaseServer.auth.admin.deleteUser(userId);
    
    if (authDeleteError) {
      console.error('Auth user deletion failed:', authDeleteError);
      return res.status(500).json({ error: 'Failed to complete account deletion. Please contact support.' });
    }
    
    // Log any non-critical deletion issues for monitoring
    if (deletionErrors.length > 0) {
      console.warn(`Account deleted with some non-critical errors for ${userEmail}:`, deletionErrors);
    }
    
    console.log(`Account successfully deleted for: ${userEmail}`);
    res.json({ success: true, message: 'Account deleted successfully' });
    
  } catch (error: any) {
    console.error('Account deletion error:', error);
    res.status(500).json({ error: 'An error occurred during account deletion' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend server is running' });
});

app.use('/api/blinkpay', blinkpayRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/twilio', twilioRouter);
app.use('/api/admin', adminRouter);
app.use('/api/stripe', stripeRouter);
app.use('/api/gamification', gamificationRouter);

app.post('/api/reminders/send-now', async (req, res) => {
  try {
    console.log('Manual trigger: Sending daily reminders now');
    await DailyReminderService.sendDailyReminders();
    res.json({ success: true, message: 'Daily reminders sent' });
  } catch (error: any) {
    console.error('Error sending reminders:', error);
    res.status(500).json({ error: error.message || 'Failed to send reminders' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Spline server running on port ${PORT}`);
  console.log(`Landing page: http://localhost:${PORT}`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin`);
  
  DailyReminderService.start();
});
