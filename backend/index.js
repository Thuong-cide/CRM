'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { initDb, getPool } = require('./src/database');
const { setupBot, sendDailyReminder } = require('./src/telegram');

const app = express();

app.use(cors({
  origin: true, // Allow all origins (mobile app cần truy cập từ IP local)
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth',       require('./src/routes/auth'));
app.use('/api/customers',  require('./src/routes/customers'));
app.use('/api/orders',     require('./src/routes/orders'));
app.use('/api/products',   require('./src/routes/products'));
app.use('/api/warranties', require('./src/routes/warranties'));
app.use('/api/dashboard',  require('./src/routes/dashboard'));
app.use('/api/search',     require('./src/routes/search'));

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Lỗi server' });
});

// Telegram bot
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || null;
const bot = setupBot(getPool);

// Cron: nhắc gia hạn mỗi ngày lúc 8:00 sáng (giờ VN)
if (TELEGRAM_CHAT_ID) {
  cron.schedule('0 8 * * *', () => {
    sendDailyReminder(TELEGRAM_CHAT_ID, getPool);
  }, { timezone: 'Asia/Ho_Chi_Minh' });
  console.log('✅ Cron nhắc gia hạn: 8:00 sáng hàng ngày');
}

const PORT = process.env.PORT || 3001;

// Init DB then start server
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 CRM Backend chạy tại http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Không thể khởi động: lỗi DB init', err);
    process.exit(1);
  });
