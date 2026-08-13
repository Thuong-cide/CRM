'use strict';
const express = require('express');
const { getPool } = require('../database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);

// GET /api/products
router.get('/', async (req, res) => {
  try {
    const { rows } = await getPool().query('SELECT * FROM products WHERE is_active=1 ORDER BY name');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products
router.post('/', async (req, res) => {
  try {
    const { name, duration_months = 1, price, cost_price, description } = req.body || {};
    if (!name || !price) return res.status(400).json({ error: 'Thiếu tên hoặc giá' });
    const result = await getPool().query(
      'INSERT INTO products (name, duration_months, price, cost_price, description) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [name.trim(), duration_months, price, cost_price || null, description || null]
    );
    res.status(201).json({ id: result.rows[0].id, message: 'Đã thêm sản phẩm' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/products/:id
router.put('/:id', async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query('SELECT * FROM products WHERE id=$1', [req.params.id]);
    const e = rows[0];
    if (!e) return res.status(404).json({ error: 'Không tìm thấy' });

    const { name, duration_months, price, cost_price, description, is_active } = req.body || {};
    await pool.query(
      'UPDATE products SET name=$1, duration_months=$2, price=$3, cost_price=$4, description=$5, is_active=$6 WHERE id=$7',
      [
        name ?? e.name,
        duration_months ?? e.duration_months,
        price ?? e.price,
        cost_price !== undefined ? cost_price : e.cost_price,
        description ?? e.description,
        is_active ?? e.is_active,
        req.params.id
      ]
    );
    res.json({ message: 'Đã cập nhật' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/:id — soft delete (is_active=0)
router.delete('/:id', async (req, res) => {
  try {
    await getPool().query('UPDATE products SET is_active=0 WHERE id=$1', [req.params.id]);
    res.json({ message: 'Đã ẩn sản phẩm' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
