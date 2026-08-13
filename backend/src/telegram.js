'use strict';
let bot = null;

function setupBot(getPool) {
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

    bot.onText(/\/stats/, async (msg) => {
      try {
        const pool = getPool();
        const days = parseInt(process.env.RENEW_DAYS_BEFORE || 7);
        const [buyersRes, leadsRes, activeRes, warrantiesRes, expiringRes] = await Promise.all([
          pool.query("SELECT COUNT(*) as v FROM customers WHERE type='buyer'"),
          pool.query("SELECT COUNT(*) as v FROM customers WHERE type='lead'"),
          pool.query("SELECT COUNT(*) as v FROM orders WHERE status='active'"),
          pool.query("SELECT COUNT(*) as v FROM warranties"),
          pool.query(`
            SELECT COUNT(*) as v FROM orders
            WHERE status='active'
              AND expire_date <= CURRENT_DATE + ($1 || ' days')::INTERVAL
              AND expire_date >= CURRENT_DATE
          `, [days]),
        ]);
        bot.sendMessage(msg.chat.id,
          `📊 *Thống kê CRM*\n\n` +
          `👥 Khách đã mua: *${buyersRes.rows[0].v}*\n` +
          `🎯 Khách tiềm năng: *${leadsRes.rows[0].v}*\n` +
          `📦 Đơn đang active: *${activeRes.rows[0].v}*\n` +
          `🔧 Tổng bảo hành: *${warrantiesRes.rows[0].v}*\n` +
          `⚠️ Sắp hết hạn (${days} ngày): *${expiringRes.rows[0].v}*`,
          { parse_mode: 'Markdown' }
        );
      } catch (e) {
        bot.sendMessage(msg.chat.id, '❌ Lỗi: ' + e.message);
      }
    });

    bot.onText(/\/expiring/, async (msg) => {
      try {
        const pool = getPool();
        const days = parseInt(process.env.RENEW_DAYS_BEFORE || 7);
        const { rows } = await pool.query(`
          SELECT o.expire_date, o.account_email, p.name as product_name,
                 c.name as customer_name, c.phone
          FROM orders o
          LEFT JOIN products p ON o.product_id = p.id
          LEFT JOIN customers c ON o.customer_id = c.id
          WHERE o.status='active'
            AND o.expire_date <= CURRENT_DATE + ($1 || ' days')::INTERVAL
            AND o.expire_date >= CURRENT_DATE
          ORDER BY o.expire_date ASC LIMIT 15
        `, [days]);

        if (!rows.length) {
          return bot.sendMessage(msg.chat.id, `✅ Không có đơn nào hết hạn trong ${days} ngày tới`);
        }

        const text = rows.map(r =>
          `• *${r.customer_name}* (${r.phone || '—'})\n  ${r.product_name} — hết hạn: ${r.expire_date}\n  ${r.account_email || ''}`
        ).join('\n\n');

        bot.sendMessage(msg.chat.id, `⚠️ *Đơn sắp hết hạn (${days} ngày tới):*\n\n${text}`, { parse_mode: 'Markdown' });
      } catch (e) {
        bot.sendMessage(msg.chat.id, '❌ Lỗi: ' + e.message);
      }
    });

    bot.onText(/\/search (.+)/, async (msg, match) => {
      try {
        const q = `%${match[1]}%`;
        const pool = getPool();
        const { rows: customers } = await pool.query(`
          SELECT c.name, c.phone, c.email, c.type,
                 (SELECT COUNT(*) FROM orders o WHERE o.customer_id=c.id) as orders
          FROM customers c
          WHERE c.name ILIKE $1 OR c.phone ILIKE $2 OR c.email ILIKE $3
          LIMIT 5
        `, [q, q, q]);

        if (!customers.length) return bot.sendMessage(msg.chat.id, '❌ Không tìm thấy khách hàng');

        const text = customers.map(c =>
          `👤 *${c.name}*\n  SĐT: ${c.phone || '—'} | Email: ${c.email || '—'}\n  Loại: ${c.type === 'buyer' ? '✅ Đã mua' : '🎯 Tiềm năng'} | Đơn hàng: ${c.orders}`
        ).join('\n\n');

        bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
      } catch (e) {
        bot.sendMessage(msg.chat.id, '❌ Lỗi: ' + e.message);
      }
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
async function sendDailyReminder(chatId, getPool) {
  if (!bot || !chatId) return;
  try {
    const pool = getPool();
    const days = parseInt(process.env.RENEW_DAYS_BEFORE || 7);
    const { rows } = await pool.query(`
      SELECT o.expire_date, p.name as product_name, c.name as customer_name, c.phone
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.status='active'
        AND o.expire_date <= CURRENT_DATE + ($1 || ' days')::INTERVAL
        AND o.expire_date >= CURRENT_DATE
      ORDER BY o.expire_date ASC LIMIT 20
    `, [days]);

    if (!rows.length) return;

    const text = rows.map(r =>
      `• *${r.customer_name}* — ${r.product_name}\n  Hết hạn: ${r.expire_date} | SĐT: ${r.phone || '—'}`
    ).join('\n\n');

    bot.sendMessage(chatId,
      `🔔 *Nhắc nhở gia hạn hôm nay*\n\n${text}`,
      { parse_mode: 'Markdown' }
    ).catch(e => console.error('Telegram send error:', e.message));
  } catch (e) {
    console.error('sendDailyReminder error:', e.message);
  }
}

module.exports = { setupBot, sendDailyReminder };
