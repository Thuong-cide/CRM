'use strict';
let bot = null;

function setupBot(getDb) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === 'YOUR_BOT_TOKEN_HERE') {
    console.log('⚠️  Telegram bot chưa cấu hình (TELEGRAM_BOT_TOKEN)');
    return null;
  }
  try {
    const TelegramBot = require('node-telegram-bot-api');
    bot = new TelegramBot(token, { polling: true });

    bot.onText(/\/start/, (msg) => {
      bot.sendMessage(msg.chat.id, '🦞 CRM Bot đang hoạt động!\n\n/stats — Thống kê tổng quan\n/expiring — Đơn sắp hết hạn\n/search <từ khóa> — Tra cứu khách hàng');
    });

    bot.onText(/\/stats/, (msg) => {
      const db = getDb();
      const days = parseInt(process.env.RENEW_DAYS_BEFORE || 7);
      const buyers = db.prepare("SELECT COUNT(*) as v FROM customers WHERE type='buyer'").get().v;
      const leads = db.prepare("SELECT COUNT(*) as v FROM customers WHERE type='lead'").get().v;
      const active = db.prepare("SELECT COUNT(*) as v FROM orders WHERE status='active'").get().v;
      const warranties = db.prepare("SELECT COUNT(*) as v FROM warranties").get().v;
      const expiring = db.prepare(`
        SELECT COUNT(*) as v FROM orders
        WHERE status='active'
          AND date(expire_date) <= date('now', '+' || ? || ' days')
          AND date(expire_date) >= date('now')
      `).get(days).v;

      bot.sendMessage(msg.chat.id,
        `📊 *Thống kê CRM*\n\n` +
        `👥 Khách đã mua: *${buyers}*\n` +
        `🎯 Khách tiềm năng: *${leads}*\n` +
        `📦 Đơn đang active: *${active}*\n` +
        `🔧 Tổng bảo hành: *${warranties}*\n` +
        `⚠️ Sắp hết hạn (${days} ngày): *${expiring}*`,
        { parse_mode: 'Markdown' }
      );
    });

    bot.onText(/\/expiring/, (msg) => {
      const db = getDb();
      const days = parseInt(process.env.RENEW_DAYS_BEFORE || 7);
      const rows = db.prepare(`
        SELECT o.expire_date, o.account_email, p.name as product_name,
               c.name as customer_name, c.phone
        FROM orders o
        LEFT JOIN products p ON o.product_id = p.id
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.status='active'
          AND date(o.expire_date) <= date('now', '+' || ? || ' days')
          AND date(o.expire_date) >= date('now')
        ORDER BY o.expire_date ASC LIMIT 15
      `).all(days);

      if (!rows.length) {
        return bot.sendMessage(msg.chat.id, `✅ Không có đơn nào hết hạn trong ${days} ngày tới`);
      }

      const text = rows.map(r =>
        `• *${r.customer_name}* (${r.phone || '—'})\n  ${r.product_name} — hết hạn: ${r.expire_date}\n  ${r.account_email || ''}`
      ).join('\n\n');

      bot.sendMessage(msg.chat.id, `⚠️ *Đơn sắp hết hạn (${days} ngày tới):*\n\n${text}`, { parse_mode: 'Markdown' });
    });

    bot.onText(/\/search (.+)/, (msg, match) => {
      const q = `%${match[1]}%`;
      const db = getDb();
      const customers = db.prepare(`
        SELECT c.name, c.phone, c.email, c.type,
               (SELECT COUNT(*) FROM orders o WHERE o.customer_id=c.id) as orders
        FROM customers c
        WHERE c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?
        LIMIT 5
      `).all(q, q, q);

      if (!customers.length) return bot.sendMessage(msg.chat.id, '❌ Không tìm thấy khách hàng');

      const text = customers.map(c =>
        `👤 *${c.name}*\n  SĐT: ${c.phone || '—'} | Email: ${c.email || '—'}\n  Loại: ${c.type === 'buyer' ? '✅ Đã mua' : '🎯 Tiềm năng'} | Đơn hàng: ${c.orders}`
      ).join('\n\n');

      bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
    });

    bot.on('polling_error', (e) => console.error('Telegram error:', e.message));
    console.log('✅ Telegram bot đang chạy');
    return bot;
  } catch (e) {
    console.error('❌ Lỗi khởi động Telegram bot:', e.message);
    return null;
  }
}

// Gửi nhắc nhở hàng ngày
function sendDailyReminder(chatId, getDb) {
  if (!bot || !chatId) return;
  const db = getDb();
  const days = parseInt(process.env.RENEW_DAYS_BEFORE || 7);
  const rows = db.prepare(`
    SELECT o.expire_date, p.name as product_name, c.name as customer_name, c.phone
    FROM orders o
    LEFT JOIN products p ON o.product_id = p.id
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE o.status='active'
      AND date(o.expire_date) <= date('now', '+' || ? || ' days')
      AND date(o.expire_date) >= date('now')
    ORDER BY o.expire_date ASC LIMIT 20
  `).all(days);

  if (!rows.length) return;

  const text = rows.map(r =>
    `• *${r.customer_name}* — ${r.product_name}\n  Hết hạn: ${r.expire_date} | SĐT: ${r.phone || '—'}`
  ).join('\n\n');

  bot.sendMessage(chatId,
    `🔔 *Nhắc nhở gia hạn hôm nay*\n\n${text}`,
    { parse_mode: 'Markdown' }
  ).catch(e => console.error('Telegram send error:', e.message));
}

module.exports = { setupBot, sendDailyReminder };
