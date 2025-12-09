import nodemailer from 'nodemailer';

const ADMIN_EMAIL = 'hzeng1217@gmail.com';

interface WithdrawalEmailData {
  userId: string;
  userDatabaseId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  amount: number;
  feeAmount: number;
  netAmount: number;
  withdrawalType: 'fast' | 'normal';
  bankName: string;
  accountNumber: string;      // Full account number for transfer
  accountHolderName: string;  // Account holder name
  accountLast4: string;
  estimatedArrival: string;
  transactionId: string;
  remainingBalance: number;   // User's remaining wallet balance after withdrawal
}

const createTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.warn('Email service: SMTP credentials not configured. Emails will be logged only.');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
};

export async function sendWithdrawalNotification(data: WithdrawalEmailData): Promise<boolean> {
  const transporter = createTransporter();

  const emailContent = `
NEW WITHDRAWAL REQUEST - SPLINE PAY
====================================

Transaction ID: ${data.transactionId}
Time: ${new Date().toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })}

USER DETAILS
------------
Name: ${data.userName}
Email: ${data.userEmail}
Phone: ${data.userPhone}
User ID (Spline ID): ${data.userId}
Database ID: ${data.userDatabaseId}

WITHDRAWAL DETAILS
------------------
Transfer Type: ${data.withdrawalType.toUpperCase()} ${data.withdrawalType === 'fast' ? '(3.5% fee)' : '(Free)'}
Amount Requested: $${data.amount.toFixed(2)}
Fee Deducted: $${data.feeAmount.toFixed(2)}
Net Amount to Transfer: $${data.netAmount.toFixed(2)}
Remaining Balance: $${data.remainingBalance.toFixed(2)}

BANK DETAILS (FOR TRANSFER)
---------------------------
Bank: ${data.bankName}
Account Number: ${data.accountNumber || 'Not provided'}
Account Holder: ${data.accountHolderName || 'Not provided'}
Estimated Arrival: ${data.estimatedArrival}

ACTION REQUIRED
---------------
Please process this ${data.withdrawalType === 'fast' ? 'FAST (priority)' : 'NORMAL'} transfer of $${data.netAmount.toFixed(2)} to the user's bank account.

Once processed, update the status in the Admin Dashboard:
https://splinepay.replit.app/admin → Withdrawals → Mark as Completed

====================================
This is an automated notification from Spline Pay.
`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 20px; border-radius: 12px 12px 0 0; }
    .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 12px 12px; }
    .section { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .section-title { font-weight: 600; color: #6366f1; margin-bottom: 10px; font-size: 14px; text-transform: uppercase; }
    .label { color: #666; font-size: 12px; }
    .value { font-weight: 500; color: #333; }
    .amount { font-size: 24px; font-weight: 700; color: #10b981; }
    .fast-badge { background: #8b5cf6; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .normal-badge { background: #6b7280; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .action-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-top: 15px; border-radius: 0 8px 8px 0; }
    .btn { display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 20px;">New Withdrawal Request</h1>
      <p style="margin: 5px 0 0; opacity: 0.9; font-size: 14px;">Transaction ID: ${data.transactionId}</p>
    </div>
    <div class="content">
      <div class="section">
        <div class="section-title">Amount to Transfer</div>
        <span class="${data.withdrawalType === 'fast' ? 'fast-badge' : 'normal-badge'}">${data.withdrawalType.toUpperCase()}</span>
        <div class="amount" style="margin-top: 10px;">$${data.netAmount.toFixed(2)}</div>
        <div class="label" style="margin-top: 5px;">
          Requested: $${data.amount.toFixed(2)} | Fee: $${data.feeAmount.toFixed(2)}
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">User Details</div>
        <p><span class="label">Name:</span> <span class="value">${data.userName}</span></p>
        <p><span class="label">Email:</span> <span class="value">${data.userEmail}</span></p>
        <p><span class="label">Phone:</span> <span class="value">${data.userPhone}</span></p>
        <p><span class="label">Spline ID:</span> <span class="value" style="font-family: monospace; background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${data.userId}</span></p>
        <p><span class="label">Database ID:</span> <span class="value" style="font-family: monospace; font-size: 11px; color: #6b7280;">${data.userDatabaseId}</span></p>
        <p><span class="label">Remaining Balance:</span> <span class="value" style="font-weight: 700; color: #059669;">$${data.remainingBalance.toFixed(2)}</span></p>
      </div>
      
      <div class="section" style="background: #eff6ff; border: 1px solid #3b82f6;">
        <div class="section-title" style="color: #1d4ed8;">Bank Details (For Transfer)</div>
        <p><span class="label">Bank:</span> <span class="value" style="font-weight: 700;">${data.bankName}</span></p>
        <p><span class="label">Account Number:</span> <span class="value" style="font-family: monospace; background: #dbeafe; padding: 4px 8px; border-radius: 4px; font-weight: 700;">${data.accountNumber || 'Not provided'}</span></p>
        <p><span class="label">Account Holder:</span> <span class="value" style="font-weight: 600;">${data.accountHolderName || 'Not provided'}</span></p>
        <p><span class="label">Estimated Arrival:</span> <span class="value">${data.estimatedArrival}</span></p>
      </div>
      
      <div class="action-box">
        <strong>Action Required</strong>
        <p style="margin: 5px 0 0; font-size: 14px;">
          Process this ${data.withdrawalType === 'fast' ? '<strong>PRIORITY</strong>' : 'standard'} transfer of <strong>$${data.netAmount.toFixed(2)}</strong> to the user's bank account.
        </p>
        <a href="https://splinepay.replit.app/admin" class="btn">Open Admin Dashboard</a>
      </div>
    </div>
  </div>
</body>
</html>
`;

  if (!transporter) {
    // Log minimal info without PII when email not configured
    console.log(`[Email] Withdrawal notification for transaction ${data.transactionId} - SMTP not configured`);
    console.log(`[Email] Amount: $${data.netAmount.toFixed(2)} (${data.withdrawalType})`);
    return false;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: ADMIN_EMAIL,
      subject: `[Spline] New ${data.withdrawalType.toUpperCase()} Withdrawal: $${data.netAmount.toFixed(2)} - ${data.userName}`,
      text: emailContent,
      html: htmlContent
    });

    console.log(`Withdrawal notification email sent to ${ADMIN_EMAIL} for transaction ${data.transactionId}`);
    return true;
  } catch (error) {
    console.error('Failed to send withdrawal notification email:', error);
    // Log minimal info without PII on failure
    console.log(`[Email] FALLBACK - Transaction ${data.transactionId}, Amount: $${data.netAmount.toFixed(2)}`);
    return false;
  }
}

export async function testEmailConnection(): Promise<boolean> {
  const transporter = createTransporter();
  if (!transporter) {
    console.log('Email service not configured - SMTP credentials missing');
    return false;
  }

  try {
    await transporter.verify();
    console.log('Email service connected successfully');
    return true;
  } catch (error) {
    console.error('Email service connection failed:', error);
    return false;
  }
}

interface SuspiciousActivityData {
  userId: string;
  userName: string;
  userEmail: string;
  activityType: string;
  details: string;
  timestamp: string;
}

export async function sendSuspiciousActivityNotification(data: SuspiciousActivityData): Promise<boolean> {
  const transporter = createTransporter();

  const emailContent = `
SUSPICIOUS ACTIVITY DETECTED - SPLINE PAY
==========================================

Time: ${data.timestamp}

USER DETAILS
------------
Name: ${data.userName}
Email: ${data.userEmail}
User ID: ${data.userId}

ACTIVITY DETAILS
----------------
Type: ${data.activityType}
Details: ${data.details}

ACTION REQUIRED
---------------
Review this user's activity in the Admin Dashboard.

==========================================
This is an automated security notification from Spline Pay.
`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 20px; border-radius: 12px 12px 0 0; }
    .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 12px 12px; }
    .section { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .section-title { font-weight: 600; color: #ef4444; margin-bottom: 10px; font-size: 14px; text-transform: uppercase; }
    .label { color: #666; font-size: 12px; }
    .value { font-weight: 500; color: #333; }
    .warning-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin-top: 15px; border-radius: 0 8px 8px 0; }
    .btn { display: inline-block; background: #ef4444; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 20px;">Suspicious Activity Alert</h1>
      <p style="margin: 5px 0 0; opacity: 0.9; font-size: 14px;">${data.activityType}</p>
    </div>
    <div class="content">
      <div class="section">
        <div class="section-title">User Details</div>
        <p><span class="label">Name:</span> <span class="value">${data.userName}</span></p>
        <p><span class="label">Email:</span> <span class="value">${data.userEmail}</span></p>
        <p><span class="label">User ID:</span> <span class="value" style="font-family: monospace;">${data.userId}</span></p>
      </div>
      
      <div class="section" style="border: 1px solid #fecaca;">
        <div class="section-title">Activity Details</div>
        <p><span class="label">Type:</span> <span class="value" style="font-weight: 700; color: #ef4444;">${data.activityType}</span></p>
        <p><span class="label">Details:</span> <span class="value">${data.details}</span></p>
        <p><span class="label">Time:</span> <span class="value">${data.timestamp}</span></p>
      </div>
      
      <div class="warning-box">
        <strong>Action Required</strong>
        <p style="margin: 5px 0 0; font-size: 14px;">
          Review this user's activity in the Admin Dashboard.
        </p>
        <a href="https://splinepay.replit.app/admin" class="btn">Open Admin Dashboard</a>
      </div>
    </div>
  </div>
</body>
</html>
`;

  if (!transporter) {
    console.log(`[Email] Suspicious activity notification - SMTP not configured`);
    console.log(`[Email] User: ${data.userId}, Type: ${data.activityType}`);
    return false;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: ADMIN_EMAIL,
      subject: `[Spline ALERT] Suspicious Activity: ${data.activityType} - ${data.userName}`,
      text: emailContent,
      html: htmlContent
    });

    console.log(`Suspicious activity notification sent for user ${data.userId}`);
    return true;
  } catch (error) {
    console.error('Failed to send suspicious activity notification:', error);
    return false;
  }
}

interface UserReportData {
  reportId: string;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
  reportedUserId: string;
  reportedUserName: string;
  reportedUserEmail: string;
  reason: string;
  timestamp: string;
}

export async function sendUserReportNotification(data: UserReportData): Promise<boolean> {
  const transporter = createTransporter();

  const emailContent = `
NEW USER REPORT - SPLINE PAY
============================

Report ID: ${data.reportId}
Time: ${data.timestamp}

REPORTER DETAILS
----------------
Name: ${data.reporterName}
Email: ${data.reporterEmail}
User ID: ${data.reporterId}

REPORTED USER
-------------
Name: ${data.reportedUserName}
Email: ${data.reportedUserEmail}
User ID: ${data.reportedUserId}

REPORT REASON
-------------
${data.reason}

ACTION REQUIRED
---------------
Review this report in the Admin Dashboard under the Reports tab.

============================
This is an automated notification from Spline Pay.
`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 20px; border-radius: 12px 12px 0 0; }
    .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 12px 12px; }
    .section { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .section-title { font-weight: 600; color: #f59e0b; margin-bottom: 10px; font-size: 14px; text-transform: uppercase; }
    .label { color: #666; font-size: 12px; }
    .value { font-weight: 500; color: #333; }
    .reason-box { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 8px; margin-top: 10px; }
    .action-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-top: 15px; border-radius: 0 8px 8px 0; }
    .btn { display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 20px;">User Report Submitted</h1>
      <p style="margin: 5px 0 0; opacity: 0.9; font-size: 14px;">Report ID: ${data.reportId}</p>
    </div>
    <div class="content">
      <div class="section">
        <div class="section-title">Reporter</div>
        <p><span class="label">Name:</span> <span class="value">${data.reporterName}</span></p>
        <p><span class="label">Email:</span> <span class="value">${data.reporterEmail}</span></p>
        <p><span class="label">User ID:</span> <span class="value" style="font-family: monospace; font-size: 11px;">${data.reporterId}</span></p>
      </div>
      
      <div class="section" style="border: 1px solid #fecaca;">
        <div class="section-title" style="color: #dc2626;">Reported User</div>
        <p><span class="label">Name:</span> <span class="value" style="font-weight: 700;">${data.reportedUserName}</span></p>
        <p><span class="label">Email:</span> <span class="value">${data.reportedUserEmail}</span></p>
        <p><span class="label">User ID:</span> <span class="value" style="font-family: monospace; font-size: 11px;">${data.reportedUserId}</span></p>
      </div>
      
      <div class="section">
        <div class="section-title">Report Reason</div>
        <div class="reason-box">
          ${data.reason}
        </div>
      </div>
      
      <div class="action-box">
        <strong>Action Required</strong>
        <p style="margin: 5px 0 0; font-size: 14px;">
          Review this report in the Admin Dashboard.
        </p>
        <a href="https://splinepay.replit.app/admin" class="btn">Open Admin Dashboard</a>
      </div>
    </div>
  </div>
</body>
</html>
`;

  if (!transporter) {
    console.log(`[Email] User report notification - SMTP not configured`);
    console.log(`[Email] Report ID: ${data.reportId}, Reporter: ${data.reporterId}, Reported: ${data.reportedUserId}`);
    return false;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: ADMIN_EMAIL,
      subject: `[Spline REPORT] User Reported: ${data.reportedUserName} by ${data.reporterName}`,
      text: emailContent,
      html: htmlContent
    });

    console.log(`User report notification sent for report ${data.reportId}`);
    return true;
  } catch (error) {
    console.error('Failed to send user report notification:', error);
    return false;
  }
}

interface VoucherClaimData {
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  level: number;
  voucherType: string;
  voucherValue: string;
  claimedAt: string;
}

export async function sendVoucherClaimNotification(data: VoucherClaimData): Promise<boolean> {
  const transporter = createTransporter();

  const emailContent = `
NEW VOUCHER CLAIM - SPLINE PAY
==============================

Time: ${data.claimedAt}

USER DETAILS
------------
Name: ${data.userName}
Email: ${data.userEmail}
Phone: ${data.userPhone}
User ID: ${data.userId}
Level: ${data.level}

VOUCHER DETAILS
---------------
Type: ${data.voucherType}
Value: ${data.voucherValue}

ACTION REQUIRED
---------------
Contact the user to arrange their personalized dining experience.
Collect dietary requirements and preferences.

==============================
This is an automated notification from Spline Pay.
`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 12px 12px 0 0; }
    .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 12px 12px; }
    .section { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .section-title { font-weight: 600; color: #10b981; margin-bottom: 10px; font-size: 14px; text-transform: uppercase; }
    .label { color: #666; font-size: 12px; }
    .value { font-weight: 500; color: #333; }
    .voucher-value { font-size: 24px; font-weight: 700; color: #10b981; }
    .level-badge { background: #9370DB; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .action-box { background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin-top: 15px; border-radius: 0 8px 8px 0; }
    .btn { display: inline-block; background: #10b981; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 20px;">New Voucher Claim</h1>
      <p style="margin: 5px 0 0; opacity: 0.9; font-size: 14px;">${data.voucherType}</p>
    </div>
    <div class="content">
      <div class="section">
        <div class="section-title">Voucher Details</div>
        <div class="voucher-value">${data.voucherValue}</div>
        <p style="margin-top: 10px;"><span class="label">Type:</span> <span class="value">${data.voucherType}</span></p>
      </div>
      
      <div class="section">
        <div class="section-title">User Details</div>
        <p><span class="label">Name:</span> <span class="value">${data.userName}</span></p>
        <p><span class="label">Email:</span> <span class="value">${data.userEmail}</span></p>
        <p><span class="label">Phone:</span> <span class="value">${data.userPhone}</span></p>
        <p><span class="label">Level:</span> <span class="level-badge">Level ${data.level}</span></p>
        <p><span class="label">User ID:</span> <span class="value" style="font-family: monospace; font-size: 11px;">${data.userId}</span></p>
      </div>
      
      <div class="action-box">
        <strong>Action Required</strong>
        <p style="margin: 5px 0 0; font-size: 14px;">
          Contact the user to arrange their personalized dining experience.
          <br/>Collect dietary requirements and preferences.
        </p>
        <a href="mailto:${data.userEmail}" class="btn">Email User</a>
      </div>
    </div>
  </div>
</body>
</html>
`;

  if (!transporter) {
    console.log(`[Email] Voucher claim notification - SMTP not configured`);
    console.log(`[Email] User: ${data.userId}, Voucher: ${data.voucherValue}`);
    return false;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: ADMIN_EMAIL,
      subject: `[Spline] Voucher Claimed: ${data.voucherValue} - ${data.userName}`,
      text: emailContent,
      html: htmlContent
    });

    console.log(`Voucher claim notification sent for user ${data.userId}`);
    return true;
  } catch (error) {
    console.error('Failed to send voucher claim notification:', error);
    return false;
  }
}
