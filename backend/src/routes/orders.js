'use strict';
const express = require('express');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const { customer_id, status } = req.query;
  const db = getDb();
  let where = 'WHERE 1=1';
  const params = [];
  if (customer_id) { where += ' AND o.customer_id = ?'; params.push(customer_id); }
  if (status) { where += ' AND o.status = ?'; params.push(status); }
  const rows = db.prepare(`
    SELECT o.*, p.name as product_name, c.name as customer_name, c.phone as customer_phone
    FROM orders o
    LEFT JOIN products p ON o.product_id = p.id
    LEFT JOIN customers c ON o.customer_id = c.id
    ${where} ORDER BY o.purchase_date DESC
  `).all(...params);
  res.json(rows);
});

// Đơn sắp hết hạn (trong N ngày tới)
router.get('/expiring', (req, res) => {
  const days = parseInt(req.query.days || process.env.RENEW_DAYS_BEFORE || 7);
  const db = getDb();
  const rows = db.prepare(`
    SELECT o.*, p.name as product_name, c.name as customer_name,
           c.phone as customer_phone, c.email as customer_email, c.zalo as customer_zalo
    FROM orders o
    LEFT JOIN products p ON o.product_id = p.id
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE o.status = 'active'
      AND date(o.expire_date) <= date('now', '+' || ? || ' days')
      AND date(o.expire_date) >= date('now')
    ORDER BY o.expire_date ASC
  `).all(days);
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const o = getDb().prepare(`
    SELECT o.*, p.name as product_name, c.name as customer_name
    FROM orders o
    LEFT JOIN products p ON o.product_id = p.id
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE o.id = ?
  `).get(req.params.id);
  if (!o) return res.status(404).json({ error: 'Không tìm thấy' });
  res.json(o);
});

router.post('/', (req, res) => {
  const { customer_id, product_id, account_email, quantity = 1, price, purchase_date, expire_date, notes } = req.body || {};
  if (!customer_id || !product_id || !price || !purchase_date || !expire_date)
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc: customer_id, product_id, price, purchase_date, expire_date' });

  const db = getDb();
  // Khi thêm đơn đầu tiên cho KH → cập nhật type thành buyer
  db.prepare("UPDATE customers SET type='buyer', updated_at=CURRENT_TIMESTAMP WHERE id=? AND type='lead'").run(customer_id);

  const result = db.prepare(`
    INSERT INTO orders (customer_id, product_id, account_email, quantity, price, purchase_date, expire_date, notes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `).run(customer_id, product_id, account_email || null, quantity, price, purchase_date, expire_date, notes || null);

  res.status(201).json({ id: result.lastInsertRowid, message: 'Đã tạo đơn hàng' });
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy' });
  const { account_email, quantity, price, purchase_date, expire_date, status, notes } = req.body || {};
  db.prepare(`
    UPDATE orders SET account_email=?, quantity=?, price=?, purchase_date=?, expire_date=?, status=?, notes=? WHERE id=?
  `).run(
    account_email ?? existing.account_email,
    quantity ?? existing.quantity,
    price ?? existing.price,
    purchase_date ?? existing.purchase_date,
    expire_date ?? existing.expire_date,
    status ?? existing.status,
    notes ?? existing.notes,
    req.params.id
  );
  res.json({ message: 'Đã cập nhật' });
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  res.json({ message: 'Đã xóa' });
});

module.exports = router;
