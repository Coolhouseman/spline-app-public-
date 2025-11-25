import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import blinkpayRouter from './routes/blinkpay.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend server is running' });
});

app.use('/api/blinkpay', blinkpayRouter);

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
