'use strict';
const express = require('express');
const { getPool } = require('../database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);

// GET /api/orders?customer_id=&status=&search=&page=&limit=
router.get('/', async (req, res) => {
  try {
    const { customer_id, status, search = '', page = 1, limit = 50 } = req.query;
    const pool = getPool();
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (customer_id) { where += ` AND o.customer_id = $${idx}`; params.push(customer_id); idx++; }
    if (status)      { where += ` AND o.status = $${idx}`;      params.push(status);      idx++; }
    if (search.trim()) {
      const q = `%${search.trim()}%`;
      where += ` AND (c.name ILIKE $${idx} OR c.phone ILIKE $${idx+1} OR p.name ILIKE $${idx+2} OR o.account_email ILIKE $${idx+3})`;
      params.push(q, q, q, q);
      idx += 4;
    }
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countRes = await pool.query(`
      SELECT COUNT(*) as cnt FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN customers c ON o.customer_id = c.id
      ${where}
    `, params);
    const total = parseInt(countRes.rows[0].cnt);

    const rowsRes = await pool.query(`
      SELECT o.*, p.name as product_name, c.name as customer_name, c.phone as customer_phone
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN customers c ON o.customer_id = c.id
      ${where} ORDER BY o.purchase_date DESC
      LIMIT $${idx} OFFSET $${idx+1}
    `, [...params, parseInt(limit), offset]);

    res.json({ data: rowsRes.rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders/expiring?days=7
router.get('/expiring', async (req, res) => {
  try {
    const days = parseInt(req.query.days || process.env.RENEW_DAYS_BEFORE || 7);
    const pool = getPool();
    const { rows } = await pool.query(`
      SELECT o.*, p.name as product_name, c.name as customer_name,
             c.phone as customer_phone, c.email as customer_email, c.zalo as customer_zalo
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.status = 'active'
        AND o.expire_date <= CURRENT_DATE + ($1 || ' days')::INTERVAL
        AND o.expire_date >= CURRENT_DATE
      ORDER BY o.expire_date ASC
    `, [days]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/orders/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await getPool().query(`
      SELECT o.*, p.name as product_name, c.name as customer_name
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orders
router.post('/', async (req, res) => {
  try {
    const { customer_id, product_id, account_email, quantity = 1, price, cost_price,
            purchase_date, expire_date, notes, supplier } = req.body || {};
    if (!customer_id || !product_id || !price || !purchase_date || !expire_date)
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc: customer_id, product_id, price, purchase_date, expire_date' });

    const pool = getPool();
    // Upgrade lead → buyer khi có đơn đầu tiên
    await pool.query(
      "UPDATE customers SET type='buyer', updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND type='lead'",
      [customer_id]
    );

    const result = await pool.query(`
      INSERT INTO orders (customer_id, product_id, account_email, quantity, price, cost_price, purchase_date, expire_date, notes, status, supplier)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10)
      RETURNING id
    `, [customer_id, product_id, account_email || null, quantity, price, cost_price || null,
        purchase_date, expire_date, notes || null, supplier || null]);

    res.status(201).json({ id: result.rows[0].id, message: 'Đã tạo đơn hàng' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/orders/:id
router.put('/:id', async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
    const existing = rows[0];
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy' });

    const { account_email, quantity, price, cost_price, purchase_date, expire_date,
            status, notes, supplier, refund_amount, refund_note } = req.body || {};
    await pool.query(`
      UPDATE orders SET
        account_email=$1, quantity=$2, price=$3, cost_price=$4,
        purchase_date=$5, expire_date=$6, status=$7, notes=$8,
        supplier=$9, refund_amount=$10, refund_note=$11
      WHERE id=$12
    `, [
      account_email ?? existing.account_email,
      quantity      ?? existing.quantity,
      price         ?? existing.price,
      cost_price    !== undefined ? cost_price    : existing.cost_price,
      purchase_date ?? existing.purchase_date,
      expire_date   ?? existing.expire_date,
      status        ?? existing.status,
      notes         ?? existing.notes,
      supplier      ?? existing.supplier,
      refund_amount !== undefined ? refund_amount : existing.refund_amount,
      refund_note   !== undefined ? refund_note   : existing.refund_note,
      req.params.id
    ]);
    res.json({ message: 'Đã cập nhật' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/orders/:id
router.delete('/:id', async (req, res) => {
  try {
    await getPool().query('DELETE FROM orders WHERE id = $1', [req.params.id]);
    res.json({ message: 'Đã xóa' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
