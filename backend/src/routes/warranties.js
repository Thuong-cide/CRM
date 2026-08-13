'use strict';
const express = require('express');
const { getPool } = require('../database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);

// GET /api/warranties?customer_id=&order_id=&search=&page=&limit=
router.get('/', async (req, res) => {
  try {
    const { customer_id, order_id, search = '', page = 1, limit = 30 } = req.query;
    const pool = getPool();
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (customer_id) { where += ` AND w.customer_id = $${idx}`; params.push(customer_id); idx++; }
    if (order_id)    { where += ` AND w.order_id = $${idx}`;    params.push(order_id);    idx++; }
    if (search.trim()) {
      const q = `%${search.trim()}%`;
      where += ` AND (c.name ILIKE $${idx} OR w.warranty_email ILIKE $${idx+1} OR w.issue ILIKE $${idx+2} OR p.name ILIKE $${idx+3})`;
      params.push(q, q, q, q);
      idx += 4;
    }
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countRes = await pool.query(`
      SELECT COUNT(*) as cnt FROM warranties w
      LEFT JOIN customers c ON w.customer_id = c.id
      LEFT JOIN orders o ON w.order_id = o.id
      LEFT JOIN products p ON o.product_id = p.id
      ${where}
    `, params);
    const total = parseInt(countRes.rows[0].cnt);

    const rowsRes = await pool.query(`
      SELECT w.*, c.name as customer_name, c.phone as customer_phone,
             p.name as product_name, o.account_email as order_email,
             o.expire_date as order_expire
      FROM warranties w
      LEFT JOIN customers c ON w.customer_id = c.id
      LEFT JOIN orders o ON w.order_id = o.id
      LEFT JOIN products p ON o.product_id = p.id
      ${where} ORDER BY w.warranty_date DESC, w.id DESC
      LIMIT $${idx} OFFSET $${idx+1}
    `, [...params, parseInt(limit), offset]);

    res.json({ data: rowsRes.rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/warranties
router.post('/', async (req, res) => {
  try {
    const { customer_id, order_id, warranty_email, issue, resolution, warranty_date, notes } = req.body || {};
    if (!customer_id || !issue || !warranty_date)
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
    const result = await getPool().query(`
      INSERT INTO warranties (customer_id, order_id, warranty_email, issue, resolution, warranty_date, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [customer_id, order_id || null, warranty_email || null, issue, resolution || null, warranty_date, notes || null]);
    res.status(201).json({ id: result.rows[0].id, message: 'Đã ghi bảo hành' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/warranties/:id
router.put('/:id', async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query('SELECT * FROM warranties WHERE id=$1', [req.params.id]);
    const e = rows[0];
    if (!e) return res.status(404).json({ error: 'Không tìm thấy' });

    const { warranty_email, issue, resolution, warranty_date, notes } = req.body || {};
    await pool.query(
      'UPDATE warranties SET warranty_email=$1, issue=$2, resolution=$3, warranty_date=$4, notes=$5 WHERE id=$6',
      [
        warranty_email ?? e.warranty_email,
        issue ?? e.issue,
        resolution ?? e.resolution,
        warranty_date ?? e.warranty_date,
        notes ?? e.notes,
        req.params.id
      ]
    );
    res.json({ message: 'Đã cập nhật' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/warranties/:id
router.delete('/:id', async (req, res) => {
  try {
    await getPool().query('DELETE FROM warranties WHERE id=$1', [req.params.id]);
    res.json({ message: 'Đã xóa' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
