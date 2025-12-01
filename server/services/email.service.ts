import nodemailer from 'nodemailer';

const ADMIN_EMAIL = 'hzeng1217@gmail.com';

interface WithdrawalEmailData {
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  amount: number;
  feeAmount: number;
  netAmount: number;
  withdrawalType: 'fast' | 'normal';
  bankName: string;
  accountLast4: string;
  estimatedArrival: string;
  transactionId: string;
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
User ID: ${data.userId}

WITHDRAWAL DETAILS
------------------
Transfer Type: ${data.withdrawalType.toUpperCase()} ${data.withdrawalType === 'fast' ? '(2% fee)' : '(Free)'}
Amount Requested: $${data.amount.toFixed(2)}
Fee Deducted: $${data.feeAmount.toFixed(2)}
Net Amount to Transfer: $${data.netAmount.toFixed(2)}

BANK DETAILS
------------
Bank: ${data.bankName}
Account: ****${data.accountLast4}
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
      </div>
      
      <div class="section">
        <div class="section-title">Bank Details</div>
        <p><span class="label">Bank:</span> <span class="value">${data.bankName}</span></p>
        <p><span class="label">Account:</span> <span class="value">****${data.accountLast4}</span></p>
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
