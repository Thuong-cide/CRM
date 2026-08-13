'use strict';
const express = require('express');
const { getPool } = require('../database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);

// GET /api/search?q=...
// Tìm đồng thời: khách hàng, đơn hàng (mail account), bảo hành (mail bảo hành)
router.get('/', async (req, res) => {
  try {
    const { q = '' } = req.query;
    const query = q.trim();
    if (query.length < 2) return res.json({ customers: [], orders: [], warranties: [] });

    const pool = getPool();
    const like = `%${query}%`;

    const [customersRes, ordersRes, warrantiesRes] = await Promise.all([
      // ── Khách hàng ──────────────────────────────────────
      pool.query(`
        SELECT c.id, c.name, c.phone, c.email, c.zalo, c.type,
          (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) as order_count
        FROM customers c
        WHERE c.name ILIKE $1 OR c.phone ILIKE $2 OR c.email ILIKE $3 OR c.zalo ILIKE $4
        ORDER BY c.updated_at DESC
        LIMIT 8
      `, [like, like, like, like]),

      // ── Đơn hàng (theo mail account / tên KH / sản phẩm) ─
      pool.query(`
        SELECT o.id, o.account_email, o.purchase_date, o.expire_date,
               o.status, o.price, o.supplier,
               c.id as customer_id, c.name as customer_name, c.phone as customer_phone,
               p.name as product_name
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        LEFT JOIN products p  ON o.product_id  = p.id
        WHERE o.account_email ILIKE $1
           OR c.name ILIKE $2
           OR p.name ILIKE $3
        ORDER BY o.purchase_date DESC
        LIMIT 10
      `, [like, like, like]),

      // ── Bảo hành (theo mail bảo hành / mô tả) ───────────
      pool.query(`
        SELECT w.id, w.warranty_email, w.issue, w.resolution, w.warranty_date,
               c.id as customer_id, c.name as customer_name,
               p.name as product_name,
               o.account_email as order_account, o.supplier
        FROM warranties w
        LEFT JOIN customers c ON w.customer_id = c.id
        LEFT JOIN orders o    ON w.order_id    = o.id
        LEFT JOIN products p  ON o.product_id  = p.id
        WHERE w.warranty_email ILIKE $1
           OR w.issue ILIKE $2
           OR c.name ILIKE $3
        ORDER BY w.warranty_date DESC
        LIMIT 8
      `, [like, like, like]),
    ]);

    res.json({
      customers: customersRes.rows,
      orders: ordersRes.rows,
      warranties: warrantiesRes.rows,
      query
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
