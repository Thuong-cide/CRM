'use strict';
const express = require('express');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const { customer_id, order_id } = req.query;
  const db = getDb();
  let where = 'WHERE 1=1';
  const params = [];
  if (customer_id) { where += ' AND w.customer_id = ?'; params.push(customer_id); }
  if (order_id) { where += ' AND w.order_id = ?'; params.push(order_id); }
  const rows = db.prepare(`
    SELECT w.*, c.name as customer_name, p.name as product_name
    FROM warranties w
    LEFT JOIN customers c ON w.customer_id = c.id
    LEFT JOIN orders o ON w.order_id = o.id
    LEFT JOIN products p ON o.product_id = p.id
    ${where} ORDER BY w.warranty_date DESC
  `).all(...params);
  res.json(rows);
});

router.post('/', (req, res) => {
  const { customer_id, order_id, warranty_email, issue, resolution, warranty_date, notes } = req.body || {};
  if (!customer_id || !issue || !warranty_date)
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc: customer_id, issue, warranty_date' });
  const r = getDb().prepare(`
    INSERT INTO warranties (customer_id, order_id, warranty_email, issue, resolution, warranty_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(customer_id, order_id || null, warranty_email || null, issue, resolution || null, warranty_date, notes || null);
  res.status(201).json({ id: r.lastInsertRowid, message: 'Đã ghi bảo hành' });
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const e = db.prepare('SELECT * FROM warranties WHERE id=?').get(req.params.id);
  if (!e) return res.status(404).json({ error: 'Không tìm thấy' });
  const { warranty_email, issue, resolution, warranty_date, notes } = req.body || {};
  db.prepare('UPDATE warranties SET warranty_email=?, issue=?, resolution=?, warranty_date=?, notes=? WHERE id=?').run(
    warranty_email ?? e.warranty_email, issue ?? e.issue,
    resolution ?? e.resolution, warranty_date ?? e.warranty_date,
    notes ?? e.notes, req.params.id
  );
  res.json({ message: 'Đã cập nhật' });
});

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM warranties WHERE id=?').run(req.params.id);
  res.json({ message: 'Đã xóa' });
});

module.exports = router;
