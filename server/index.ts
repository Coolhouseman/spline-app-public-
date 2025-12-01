import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import blinkpayRouter from './routes/blinkpay.routes';
import notificationsRouter from './routes/notifications.routes';
import twilioRouter from './routes/twilio.routes';
import adminRouter from './routes/admin.routes';
import { DailyReminderService } from './services/dailyReminder.service';

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

app.get('/reset-password', (req, res) => {
  const token = req.query.access_token || req.query.token || '';
  const type = req.query.type || '';
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password - Spline</title>
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
      margin-bottom: 16px;
    }
    p {
      color: #6b7280;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .btn {
      display: inline-block;
      background: #3B82F6;
      color: white;
      padding: 16px 32px;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
      margin-bottom: 16px;
      transition: background 0.2s;
    }
    .btn:hover { background: #2563eb; }
    .secondary {
      color: #6b7280;
      font-size: 14px;
    }
    .secondary a { color: #3B82F6; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo"><span class="logo-sp">Sp</span><span class="logo-line">line</span></div>
    <h1>Reset Your Password</h1>
    <p>To reset your password, please open this link in the Spline app on your phone.</p>
    <a href="spline://reset-password${token ? '?access_token=' + token : ''}${type ? '&type=' + type : ''}" class="btn">Open in Spline App</a>
    <p class="secondary">Don't have the app? <a href="/#download">Download Spline</a></p>
  </div>
</body>
</html>`;
  
  res.type('html').send(html);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend server is running' });
});

app.use('/api/blinkpay', blinkpayRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/twilio', twilioRouter);
app.use('/api/admin', adminRouter);

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
