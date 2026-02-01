import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';

import blinkpayRouter from './routes/blinkpay.routes';
import notificationsRouter from './routes/notifications.routes';
import twilioRouter from './routes/twilio.routes';
import adminRouter from './routes/admin.routes';
import stripeRouter from './routes/stripe.routes';
import gamificationRouter from './routes/gamification.routes';
import { DailyReminderService } from './services/dailyReminder.service';
import { sendWithdrawalNotification, sendUserReportNotification } from './services/email.service';

dotenv.config();

// Email transporter for admin notifications
const emailTransporter = process.env.EMAIL_HOST ? nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_PORT === '465',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
}) : null;

const app = express();
const PORT = parseInt(process.env.PORT || '8081', 10);

app.use(cors());
app.use(express.json());

const CANONICAL_HOST = process.env.CANONICAL_HOST || 'www.spline.nz';

// Static file paths - work in both local and Vercel serverless
const publicPath = path.join(__dirname, 'public');
const distPublicPath = path.join(__dirname, '../public'); // For Vercel build output
const staticPath = fs.existsSync(publicPath) ? publicPath : (fs.existsSync(distPublicPath) ? distPublicPath : path.join(process.cwd(), 'server/public'));

app.use((req, res, next) => {
  const forwardedHost = (req.headers['x-forwarded-host'] || '').toString().split(',')[0].trim();
  const hostHeader = forwardedHost || (req.headers.host || '');
  const host = hostHeader.split(':')[0];
  const isLocalhost = host === 'localhost' || host === '127.0.0.1';
  if (!isLocalhost && host && host !== CANONICAL_HOST) {
    res.redirect(301, `https://${CANONICAL_HOST}${req.originalUrl}`);
    return;
  }

  const redirectMap: Record<string, string> = {
    '/privacy.html': '/privacy',
    '/terms.html': '/terms',
    '/delete-account.html': '/delete-account',
    '/how-it-works.html': '/how-it-works',
    '/split-bills-nz.html': '/split-bills-nz',
    '/flatmate-expenses.html': '/flatmate-expenses',
  };

  const redirectTarget = redirectMap[req.path];
  if (redirectTarget) {
    const queryString = req.originalUrl.includes('?') ? `?${req.originalUrl.split('?')[1]}` : '';
    res.redirect(301, `${redirectTarget}${queryString}`);
    return;
  }

  if (req.path.length > 1 && req.path.endsWith('/')) {
    const [pathOnly, query] = req.originalUrl.split('?');
    const trimmedPath = pathOnly.replace(/\/+$/, '');
    const queryString = query ? `?${query}` : '';
    res.redirect(301, `${trimmedPath}${queryString}`);
    return;
  }

  next();
});

app.use('/admin', express.static(path.join(staticPath, 'admin')));
app.use('/images', express.static(path.join(staticPath, 'images')));

app.get(['/icon.png', '/favicon.ico'], (req, res) => {
  const faviconPath = path.join(staticPath, 'images', 'favicon.png');
  if (fs.existsSync(faviconPath)) {
    res.type('image/png');
    res.sendFile(faviconPath);
  } else {
    res.status(404).send('favicon not found');
  }
});

app.get('/robots.txt', (req, res) => {
  const robotsPath = path.join(staticPath, 'robots.txt');
  if (fs.existsSync(robotsPath)) {
    res.type('text/plain');
    res.sendFile(robotsPath);
  } else {
    res.status(404).send('robots.txt not found');
  }
});

app.get('/sitemap.xml', (req, res) => {
  const sitemapPath = path.join(staticPath, 'sitemap.xml');
  if (fs.existsSync(sitemapPath)) {
    res.type('application/xml');
    res.sendFile(sitemapPath);
  } else {
    res.status(404).send('sitemap.xml not found');
  }
});

// Google Play Console site verification
app.get('/google9ae7f141ca49f2ac.html', (req, res) => {
  const filePath = path.join(staticPath, 'google9ae7f141ca49f2ac.html');
  if (fs.existsSync(filePath)) {
    res.type('text/html');
    res.sendFile(filePath);
  } else {
    res.status(404).send('File not found');
  }
});

app.get('/', (req, res) => {
  const indexPath = path.join(staticPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('index.html not found');
  }
});

app.get('/terms', (req, res) => {
  const termsPath = path.join(staticPath, 'terms.html');
  if (fs.existsSync(termsPath)) {
    res.sendFile(termsPath);
  } else {
    res.status(404).send('terms.html not found');
  }
});

app.get('/privacy', (req, res) => {
  const privacyPath = path.join(staticPath, 'privacy.html');
  if (fs.existsSync(privacyPath)) {
    res.sendFile(privacyPath);
  } else {
    res.status(404).send('privacy.html not found');
  }
});

app.get('/delete-account', (req, res) => {
  const deletePath = path.join(staticPath, 'delete-account.html');
  if (fs.existsSync(deletePath)) {
    res.sendFile(deletePath);
  } else {
    res.status(404).send('delete-account.html not found');
  }
});

app.get('/go/app-store', (req, res) => {
  // Trackable redirect endpoint (use for Meta custom conversions / URL rules)
  // Prevent indexing of redirect endpoints.
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.redirect(302, 'https://apps.apple.com/nz/app/spline/id6756173884');
});

app.get('/go/google-play', (req, res) => {
  // Trackable redirect endpoint (use for Meta custom conversions / URL rules)
  // Prevent indexing of redirect endpoints.
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.redirect(302, 'https://play.google.com/store/apps/details?id=com.splitpaymentapp.split');
});

app.get('/how-it-works', (req, res) => {
  const pagePath = path.join(staticPath, 'how-it-works.html');
  if (fs.existsSync(pagePath)) {
    res.sendFile(pagePath);
  } else {
    res.status(404).send('how-it-works.html not found');
  }
});

app.get('/split-bills-nz', (req, res) => {
  const pagePath = path.join(staticPath, 'split-bills-nz.html');
  if (fs.existsSync(pagePath)) {
    res.sendFile(pagePath);
  } else {
    res.status(404).send('split-bills-nz.html not found');
  }
});

app.get('/flatmate-expenses', (req, res) => {
  const pagePath = path.join(staticPath, 'flatmate-expenses.html');
  if (fs.existsSync(pagePath)) {
    res.sendFile(pagePath);
  } else {
    res.status(404).send('flatmate-expenses.html not found');
  }
});

app.get('/card-setup.html', (req, res) => {
  const cardPath = path.join(staticPath, 'card-setup.html');
  if (fs.existsSync(cardPath)) {
    res.sendFile(cardPath);
  } else {
    res.status(404).send('card-setup.html not found');
  }
});

// Import Supabase for server-side password operations
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://vhicohutiocnfjwsofhy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
function getSupabaseServer() {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  try {
    return createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' },
    });
  } catch (err) {
    console.error('Failed to initialize Supabase admin client:', err);
    return null;
  }
}

// API endpoint for password reset - uses service role key server-side
app.post('/api/reset-password', async (req, res) => {
  try {
    const supabaseServer = getSupabaseServer();
    if (!supabaseServer) {
      return res.status(500).json({ error: 'Server misconfigured: Supabase admin key not set' });
    }
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
    const supabaseServer = getSupabaseServer();
    if (!supabaseServer) {
      return res.status(500).json({ error: 'Server misconfigured: Supabase admin key not set' });
    }
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const { error } = await supabaseServer.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.BACKEND_URL || 'https://splinepay.replit.app'}/reset-password`
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

// API endpoint for account deletion requests (public - for Google Play compliance)
app.post('/api/account/delete-request', async (req, res) => {
  try {
    const { email, reason } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Send notification email to admin about the deletion request
    const emailContent = `
Account Deletion Request
========================

User Email: ${email}
Reason: ${reason || 'Not provided'}
Requested At: ${new Date().toISOString()}

Please process this account deletion request within 30 days as per our privacy policy.

Steps to complete:
1. Verify the user's identity
2. Check for any pending wallet balance
3. Delete user data from Supabase
4. Send confirmation email to user
    `;

    // Send email notification to admin
    if (emailTransporter) {
      await emailTransporter.sendMail({
        from: 'Spline <noreply@spline.nz>',
        to: 'hzeng1217@gmail.com',
        subject: `Account Deletion Request - ${email}`,
        text: emailContent,
        html: emailContent.replace(/\n/g, '<br>'),
      });
    }

    console.log('Account deletion request received:', { email, reason, timestamp: new Date().toISOString() });
    
    res.json({ success: true, message: 'Deletion request submitted' });
  } catch (error: any) {
    console.error('Account deletion request error:', error);
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

// Cron job endpoint for daily reminders (Vercel Cron)
app.get('/api/cron/daily-reminders', async (req, res) => {
  // Verify this is a legitimate cron request from Vercel
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const { DailyReminderService } = await import('./services/dailyReminder.service');
    await DailyReminderService.sendDailyReminders();
    res.json({ success: true, message: 'Daily reminders sent' });
  } catch (error: any) {
    console.error('Cron daily reminders error:', error);
    res.status(500).json({ error: 'Failed to send reminders' });
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
    const supabaseServer = getSupabaseServer();
    if (!supabaseServer) {
      return res.status(500).json({ error: 'Server misconfigured: Supabase admin key not set' });
    }
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
    
    // 5.5. Delete gamification profiles
    const { error: gamificationError } = await supabaseServer
      .from('gamification_profiles')
      .delete()
      .eq('user_id', userId);
    if (gamificationError && gamificationError.code !== 'PGRST116') {
      console.error('Gamification profile delete error:', gamificationError.message);
      deletionErrors.push(`gamification: ${gamificationError.message}`);
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

// =============================================
// BLOCK/UNBLOCK USER ENDPOINTS
// =============================================

// Block a user
app.post('/api/friends/block', async (req, res) => {
  try {
    const supabaseServer = getSupabaseServer();
    if (!supabaseServer) {
      return res.status(500).json({ error: 'Server misconfigured: Supabase admin key not set' });
    }
    const { userId, blockedUserId } = req.body;
    
    if (!userId || !blockedUserId) {
      return res.status(400).json({ error: 'Missing required fields: userId and blockedUserId' });
    }
    
    if (userId === blockedUserId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }
    
    // Use RPC function to block user (handles friendship removal atomically)
    const { data, error } = await supabaseServer.rpc('block_user', {
      p_user_id: userId,
      p_blocked_user_id: blockedUserId
    });
    
    if (error) {
      console.error('Error blocking user:', error);
      return res.status(500).json({ error: 'Failed to block user', details: error.message });
    }
    
    console.log(`User ${userId} blocked user ${blockedUserId}`);
    res.json({ success: true, message: 'User blocked successfully' });
    
  } catch (error: any) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'An error occurred while blocking user' });
  }
});

// Unblock a user
app.delete('/api/friends/block/:blockedUserId', async (req, res) => {
  try {
    const supabaseServer = getSupabaseServer();
    if (!supabaseServer) {
      return res.status(500).json({ error: 'Server misconfigured: Supabase admin key not set' });
    }
    const { blockedUserId } = req.params;
    const userId = req.query.userId as string;
    
    if (!userId || !blockedUserId) {
      return res.status(400).json({ error: 'Missing required fields: userId and blockedUserId' });
    }
    
    const { error } = await supabaseServer
      .from('blocked_users')
      .delete()
      .eq('user_id', userId)
      .eq('blocked_user_id', blockedUserId);
    
    if (error) {
      console.error('Error unblocking user:', error);
      return res.status(500).json({ error: 'Failed to unblock user', details: error.message });
    }
    
    console.log(`User ${userId} unblocked user ${blockedUserId}`);
    res.json({ success: true, message: 'User unblocked successfully' });
    
  } catch (error: any) {
    console.error('Unblock user error:', error);
    res.status(500).json({ error: 'An error occurred while unblocking user' });
  }
});

// Get blocked users list
app.get('/api/friends/blocked', async (req, res) => {
  try {
    const supabaseServer = getSupabaseServer();
    if (!supabaseServer) {
      return res.status(500).json({ error: 'Server misconfigured: Supabase admin key not set' });
    }
    const userId = req.query.userId as string;
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing required field: userId' });
    }
    
    // First get blocked user IDs (avoid PostgREST FK join issues)
    const { data: blockedData, error: blockedError } = await supabaseServer
      .from('blocked_users')
      .select('id, user_id, blocked_user_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (blockedError) {
      console.error('Error fetching blocked users:', blockedError);
      return res.status(500).json({ error: 'Failed to fetch blocked users', details: blockedError.message });
    }
    
    if (!blockedData || blockedData.length === 0) {
      return res.json({ blockedUsers: [] });
    }
    
    // Then fetch user details separately
    const blockedUserIds = blockedData.map((b: { blocked_user_id: string }) => b.blocked_user_id);
    const { data: usersData, error: usersError } = await supabaseServer
      .from('users')
      .select('id, unique_id, name, email, profile_picture')
      .in('id', blockedUserIds);
    
    if (usersError) {
      console.error('Error fetching blocked user details:', usersError);
      return res.status(500).json({ error: 'Failed to fetch blocked user details', details: usersError.message });
    }
    
    // Combine the data
    const usersMap = new Map(usersData?.map((u: { id: string }) => [u.id, u]) || []);
    const blockedUsers = blockedData.map((b: { blocked_user_id: string }) => ({
      ...b,
      blocked_user: usersMap.get(b.blocked_user_id) || null
    }));
    
    res.json({ blockedUsers });
    
  } catch (error: any) {
    console.error('Get blocked users error:', error);
    res.status(500).json({ error: 'An error occurred while fetching blocked users' });
  }
});

// Check if a user is blocked
app.get('/api/friends/is-blocked', async (req, res) => {
  try {
    const supabaseServer = getSupabaseServer();
    if (!supabaseServer) {
      return res.status(500).json({ error: 'Server misconfigured: Supabase admin key not set' });
    }
    const userId = req.query.userId as string;
    const otherUserId = req.query.otherUserId as string;
    
    if (!userId || !otherUserId) {
      return res.status(400).json({ error: 'Missing required fields: userId and otherUserId' });
    }
    
    const { data, error } = await supabaseServer.rpc('is_user_blocked', {
      p_user_id: userId,
      p_other_user_id: otherUserId
    });
    
    if (error) {
      console.error('Error checking block status:', error);
      return res.status(500).json({ error: 'Failed to check block status', details: error.message });
    }
    
    res.json({ isBlocked: data || false });
    
  } catch (error: any) {
    console.error('Check block status error:', error);
    res.status(500).json({ error: 'An error occurred while checking block status' });
  }
});

// =============================================
// USER REPORT ENDPOINTS
// =============================================

// Create a user report - stores in Supabase cloud database
app.post('/api/reports', async (req, res) => {
  try {
    const supabaseServer = getSupabaseServer();
    if (!supabaseServer) {
      return res.status(500).json({ error: 'Server misconfigured: Supabase admin key not set' });
    }
    const { reporterId, reportedUserId, reason } = req.body;
    
    if (!reporterId || !reportedUserId || !reason) {
      return res.status(400).json({ error: 'Missing required fields: reporterId, reportedUserId, and reason' });
    }
    
    if (reporterId === reportedUserId) {
      return res.status(400).json({ error: 'Cannot report yourself' });
    }
    
    if (reason.length < 10) {
      return res.status(400).json({ error: 'Reason must be at least 10 characters' });
    }
    
    // Insert directly into Supabase user_reports table
    const { data: insertData, error: insertError } = await supabaseServer
      .from('user_reports')
      .insert({
        reporter_id: reporterId,
        reported_user_id: reportedUserId,
        reason: reason,
        status: 'pending'
      })
      .select('id')
      .single();
    
    if (insertError) {
      console.error('Error creating report:', insertError);
      return res.status(500).json({ error: 'Failed to create report', details: insertError.message });
    }
    
    const reportId = insertData?.id;
    
    // Get user details from Supabase for email notification
    const { data: users } = await supabaseServer
      .from('users')
      .select('id, name, email')
      .in('id', [reporterId, reportedUserId]);
    
    const reporter = users?.find((u: { id: string }) => u.id === reporterId);
    const reportedUser = users?.find((u: { id: string }) => u.id === reportedUserId);
    
    // Send email notification to admin
    if (reporter && reportedUser) {
      await sendUserReportNotification({
        reportId,
        reporterId,
        reporterName: reporter.name || 'Unknown',
        reporterEmail: reporter.email || 'Unknown',
        reportedUserId,
        reportedUserName: reportedUser.name || 'Unknown',
        reportedUserEmail: reportedUser.email || 'Unknown',
        reason,
        timestamp: new Date().toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })
      });
    }
    
    console.log(`Report created: ${reporterId} reported ${reportedUserId}`);
    res.json({ success: true, reportId, message: 'Report submitted successfully' });
    
  } catch (error: any) {
    console.error('Create report error:', error);
    res.status(500).json({ error: 'An error occurred while creating report' });
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

// Export for Vercel serverless
export default app;

// Only listen when running directly (not in Vercel serverless)
// But ALWAYS initialize app to prevent 'module not found' errors if something else imports it
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const PORT = parseInt(process.env.PORT || '8082', 10);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}
