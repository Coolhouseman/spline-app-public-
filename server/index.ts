import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import blinkpayRouter from './routes/blinkpay.routes';
import notificationsRouter from './routes/notifications.routes';
import twilioRouter from './routes/twilio.routes';
import { DailyReminderService } from './services/dailyReminder.service';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '8082', 10);

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend server is running' });
});

app.use('/api/blinkpay', blinkpayRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/twilio', twilioRouter);

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
  console.log(`Backend server running on port ${PORT}`);
  
  DailyReminderService.start();
});
