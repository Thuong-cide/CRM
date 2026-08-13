'use strict';
const express = require('express');
const { getPool } = require('../database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);

// Helper: build $N placeholders incrementally
function ph(arr) {
  // returns next $N index starting after arr.length
  // Use nextPh() below instead
}

// GET /api/customers?search=&type=&page=&limit=&deleted=1
router.get('/', async (req, res) => {
  try {
    const { search = '', type = '', page = 1, limit = 20, deleted = '' } = req.query;
    const pool = getPool();
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = deleted === '1' ? 'WHERE c.deleted_at IS NOT NULL' : 'WHERE c.deleted_at IS NULL';
    const params = [];
    let idx = 1;

    if (search.trim()) {
      const q = `%${search.trim()}%`;
      where += ` AND (
        c.name ILIKE $${idx} OR c.phone ILIKE $${idx+1} OR c.email ILIKE $${idx+2} OR c.zalo ILIKE $${idx+3}
        OR EXISTS (
          SELECT 1 FROM orders o WHERE o.customer_id = c.id AND o.account_email ILIKE $${idx+4}
        )
        OR EXISTS (
          SELECT 1 FROM warranties w WHERE w.customer_id = c.id AND w.warranty_email ILIKE $${idx+5}
        )
      )`;
      params.push(q, q, q, q, q, q);
      idx += 6;
    }
    if (type) {
      where += ` AND c.type = $${idx}`;
      params.push(type);
      idx++;
    }

    const countRes = await pool.query(
      `SELECT COUNT(*) as cnt FROM customers c ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].cnt);

    const rows = await pool.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) as order_count,
        (SELECT COUNT(*) FROM warranties w WHERE w.customer_id = c.id) as warranty_count,
        (SELECT MIN(o.purchase_date) FROM orders o WHERE o.customer_id = c.id) as first_purchase,
        (SELECT MAX(o.expire_date) FROM orders o WHERE o.customer_id = c.id) as last_expire
      FROM customers c
      ${where}
      ORDER BY c.updated_at DESC
      LIMIT $${idx} OFFSET $${idx+1}
    `, [...params, parseInt(limit), offset]);

    res.json({ data: rows.rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/:id — full detail
router.get('/:id', async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) as order_count,
        (SELECT COUNT(*) FROM warranties w WHERE w.customer_id = c.id) as warranty_count,
        (SELECT MIN(o.purchase_date) FROM orders o WHERE o.customer_id = c.id) as first_purchase
      FROM customers c WHERE c.id = $1
    `, [req.params.id]);
    const c = rows[0];
    if (!c) return res.status(404).json({ error: 'Không tìm thấy' });

    const ordersRes = await pool.query(`
      SELECT o.*, p.name as product_name
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      WHERE o.customer_id = $1
      ORDER BY o.purchase_date DESC
    `, [req.params.id]);

    const warrantiesRes = await pool.query(`
      SELECT w.*, p.name as product_name
      FROM warranties w
      LEFT JOIN orders o ON w.order_id = o.id
      LEFT JOIN products p ON o.product_id = p.id
      WHERE w.customer_id = $1
      ORDER BY w.warranty_date DESC
    `, [req.params.id]);

    res.json({ ...c, orders: ordersRes.rows, warranties: warrantiesRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, zalo, facebook, type = 'lead', source, interest, notes } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: 'Tên khách hàng không được trống' });
    const pool = getPool();
    const result = await pool.query(`
      INSERT INTO customers (name, phone, email, zalo, facebook, type, source, interest, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      name.trim(),
      phone || null, email || null, zalo || null, facebook || null,
      type, source || null, interest || null, notes || null
    ]);
    res.status(201).json({ id: result.rows[0].id, message: 'Đã thêm khách hàng' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/customers/:id
router.put('/:id', async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    const existing = rows[0];
    if (!existing) return res.status(404).json({ error: 'Không tìm thấy' });

    const { name, phone, email, zalo, facebook, type, source, interest, notes } = req.body || {};
    await pool.query(`
      UPDATE customers SET
        name=$1, phone=$2, email=$3, zalo=$4, facebook=$5, type=$6, source=$7, interest=$8, notes=$9,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=$10
    `, [
      name ?? existing.name,
      phone ?? existing.phone, email ?? existing.email,
      zalo ?? existing.zalo, facebook ?? existing.facebook,
      type ?? existing.type, source ?? existing.source,
      interest ?? existing.interest, notes ?? existing.notes,
      req.params.id
    ]);
    res.json({ message: 'Đã cập nhật' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/customers/:id — soft delete
router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    const id = req.params.id;
    const { rows } = await pool.query('SELECT id, name, deleted_at FROM customers WHERE id = $1', [id]);
    const customer = rows[0];
    if (!customer) return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
    if (customer.deleted_at) return res.status(400).json({ error: 'Khách hàng đã bị ẩn trước đó' });

    await pool.query('UPDATE customers SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    res.json({ message: `Đã ẩn khách hàng "${customer.name}". Vào Thùng rác để khôi phục.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers/:id/restore — khôi phục soft-deleted
router.post('/:id/restore', async (req, res) => {
  try {
    const pool = getPool();
    const id = req.params.id;
    const { rows } = await pool.query('SELECT id, name, deleted_at FROM customers WHERE id = $1', [id]);
    const customer = rows[0];
    if (!customer) return res.status(404).json({ error: 'Không tìm thấy' });
    if (!customer.deleted_at) return res.status(400).json({ error: 'Khách hàng chưa bị ẩn' });

    await pool.query('UPDATE customers SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    res.json({ message: `Đã khôi phục khách hàng "${customer.name}"` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/customers/:id/permanent — xóa vĩnh viễn
router.delete('/:id/permanent', async (req, res) => {
  try {
    const pool = getPool();
    const id = req.params.id;
    const { rows } = await pool.query('SELECT id, name FROM customers WHERE id = $1', [id]);
    const customer = rows[0];
    if (!customer) return res.status(404).json({ error: 'Không tìm thấy' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM warranties WHERE customer_id = $1', [id]);
      await client.query('DELETE FROM orders WHERE customer_id = $1', [id]);
      await client.query('DELETE FROM customers WHERE id = $1', [id]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    res.json({ message: `Đã xóa vĩnh viễn "${customer.name}"` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
