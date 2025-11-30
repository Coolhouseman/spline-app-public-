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
