'use strict';
const express = require('express');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);

// GET /api/customers?search=&type=&page=&limit=
router.get('/', (req, res) => {
  const { search = '', type = '', page = 1, limit = 20 } = req.query;
  const db = getDb();
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let where = 'WHERE 1=1';
  const params = [];

  if (search.trim()) {
    where += ` AND (
      c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR c.zalo LIKE ?
      OR EXISTS (
        SELECT 1 FROM orders o WHERE o.customer_id = c.id AND o.account_email LIKE ?
      )
      OR EXISTS (
        SELECT 1 FROM warranties w WHERE w.customer_id = c.id AND w.warranty_email LIKE ?
      )
    )`;
    const q = `%${search.trim()}%`;
    params.push(q, q, q, q, q, q);
  }
  if (type) { where += ' AND c.type = ?'; params.push(type); }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM customers c ${where}`).get(...params).cnt;
  const rows = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) as order_count,
      (SELECT COUNT(*) FROM warranties w WHERE w.customer_id = c.id) as warranty_count,
      (SELECT MIN(o.purchase_date) FROM orders o WHERE o.customer_id = c.id) as first_purchase,
      (SELECT MAX(o.expire_date) FROM orders o WHERE o.customer_id = c.id) as last_expire
    FROM customers c
    ${where}
    ORDER BY c.updated_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ data: rows, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/customers/:id — full detail
router.get('/:id', (req, res) => {
  const db = getDb();
  const c = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) as order_count,
      (SELECT COUNT(*) FROM warranties w WHERE w.customer_id = c.id) as warranty_count,
      (SELECT MIN(o.purchase_date) FROM orders o WHERE o.customer_id = c.id) as first_purchase
    FROM customers c WHERE c.id = ?
  `).get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Không tìm thấy' });

  const orders = db.prepare(`
    SELECT o.*, p.name as product_name
    FROM orders o
    LEFT JOIN products p ON o.product_id = p.id
    WHERE o.customer_id = ?
    ORDER BY o.purchase_date DESC
  `).all(req.params.id);

  const warranties = db.prepare(`
    SELECT w.*, p.name as product_name
    FROM warranties w
    LEFT JOIN orders o ON w.order_id = o.id
    LEFT JOIN products p ON o.product_id = p.id
    WHERE w.customer_id = ?
    ORDER BY w.warranty_date DESC
  `).all(req.params.id);

  res.json({ ...c, orders, warranties });
});

// POST /api/customers
router.post('/', (req, res) => {
  const { name, phone, email, zalo, facebook, type = 'lead', source, interest, notes } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Tên khách hàng không được trống' });
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO customers (name, phone, email, zalo, facebook, type, source, interest, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name.trim(),
    phone || null, email || null, zalo || null, facebook || null,
    type, source || null, interest || null, notes || null
  );
  res.status(201).json({ id: result.lastInsertRowid, message: 'Đã thêm khách hàng' });
});

// PUT /api/customers/:id
router.put('/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy' });
  const { name, phone, email, zalo, facebook, type, source, interest, notes } = req.body || {};
  db.prepare(`
    UPDATE customers SET
      name=?, phone=?, email=?, zalo=?, facebook=?, type=?, source=?, interest=?, notes=?,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    name ?? existing.name,
    phone ?? existing.phone, email ?? existing.email,
    zalo ?? existing.zalo, facebook ?? existing.facebook,
    type ?? existing.type, source ?? existing.source,
    interest ?? existing.interest, notes ?? existing.notes,
    req.params.id
  );
  res.json({ message: 'Đã cập nhật' });
});

// DELETE /api/customers/:id
router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
  res.json({ message: 'Đã xóa' });
});

module.exports = router;
