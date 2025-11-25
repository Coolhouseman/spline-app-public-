import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import blinkpayRouter from './routes/blinkpay.routes';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '8082', 10);

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend server is running' });
});

app.use('/api/blinkpay', blinkpayRouter);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on port ${PORT}`);
});
