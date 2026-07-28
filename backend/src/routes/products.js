'use strict';
const express = require('express');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  res.json(getDb().prepare('SELECT * FROM products WHERE is_active=1 ORDER BY name').all());
});

router.post('/', (req, res) => {
  const { name, duration_months = 1, price, description } = req.body || {};
  if (!name || !price) return res.status(400).json({ error: 'Thiếu tên hoặc giá' });
  const r = getDb().prepare('INSERT INTO products (name, duration_months, price, description) VALUES (?,?,?,?)').run(name.trim(), duration_months, price, description || null);
  res.status(201).json({ id: r.lastInsertRowid, message: 'Đã thêm sản phẩm' });
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const e = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!e) return res.status(404).json({ error: 'Không tìm thấy' });
  const { name, duration_months, price, description, is_active } = req.body || {};
  db.prepare('UPDATE products SET name=?, duration_months=?, price=?, description=?, is_active=? WHERE id=?').run(
    name ?? e.name, duration_months ?? e.duration_months, price ?? e.price,
    description ?? e.description, is_active ?? e.is_active, req.params.id
  );
  res.json({ message: 'Đã cập nhật' });
});

router.delete('/:id', (req, res) => {
  getDb().prepare('UPDATE products SET is_active=0 WHERE id=?').run(req.params.id);
  res.json({ message: 'Đã ẩn sản phẩm' });
});

module.exports = router;
