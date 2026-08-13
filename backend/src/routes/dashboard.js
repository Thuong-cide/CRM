'use strict';
const express = require('express');
const { getPool } = require('../database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const pool = getPool();
    const days = parseInt(process.env.RENEW_DAYS_BEFORE || 7);

    const [
      totalCustomersRes,
      buyersRes,
      leadsRes,
      totalOrdersRes,
      activeOrdersRes,
      totalWarrantiesRes,
      expiringRes,
      thisMonthRes
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) as v FROM customers WHERE deleted_at IS NULL"),
      pool.query("SELECT COUNT(*) as v FROM customers WHERE type='buyer' AND deleted_at IS NULL"),
      pool.query("SELECT COUNT(*) as v FROM customers WHERE type='lead' AND deleted_at IS NULL"),
      pool.query("SELECT COUNT(*) as v FROM orders"),
      pool.query("SELECT COUNT(*) as v FROM orders WHERE status='active'"),
      pool.query("SELECT COUNT(*) as v FROM warranties"),
      pool.query(`
        SELECT COUNT(*) as v FROM orders
        WHERE status='active'
          AND expire_date <= CURRENT_DATE + ($1 || ' days')::INTERVAL
          AND expire_date >= CURRENT_DATE
      `, [days]),
      pool.query(`
        SELECT
          COALESCE(SUM(price * quantity), 0) as revenue,
          COALESCE(SUM(CASE WHEN cost_price IS NOT NULL THEN (price - cost_price) * quantity ELSE 0 END), 0) as profit
        FROM orders
        WHERE status != 'cancelled'
          AND TO_CHAR(purchase_date, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
      `)
    ]);

    res.json({
      totalCustomers:   parseInt(totalCustomersRes.rows[0].v),
      buyers:           parseInt(buyersRes.rows[0].v),
      leads:            parseInt(leadsRes.rows[0].v),
      totalOrders:      parseInt(totalOrdersRes.rows[0].v),
      activeOrders:     parseInt(activeOrdersRes.rows[0].v),
      totalWarranties:  parseInt(totalWarrantiesRes.rows[0].v),
      expiring:         parseInt(expiringRes.rows[0].v),
      expiringDays:     days,
      revenueThisMonth: parseFloat(thisMonthRes.rows[0].revenue),
      profitThisMonth:  parseFloat(thisMonthRes.rows[0].profit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/revenue?months=6
router.get('/revenue', async (req, res) => {
  try {
    const months = Math.min(parseInt(req.query.months || 6), 24);
    const pool = getPool();

    // Generate month series in PostgreSQL
    const { rows } = await pool.query(`
      SELECT
        TO_CHAR(gs.month, 'YYYY-MM') as month,
        COALESCE(SUM(o.price * o.quantity), 0) as revenue,
        COALESCE(SUM(CASE WHEN o.cost_price IS NOT NULL THEN o.cost_price * o.quantity ELSE 0 END), 0) as cost,
        COALESCE(SUM(CASE WHEN o.cost_price IS NOT NULL THEN (o.price - o.cost_price) * o.quantity ELSE 0 END), 0) as profit,
        COUNT(o.id) as order_count
      FROM generate_series(
        DATE_TRUNC('month', CURRENT_DATE) - (($1 - 1) || ' months')::INTERVAL,
        DATE_TRUNC('month', CURRENT_DATE),
        '1 month'::INTERVAL
      ) AS gs(month)
      LEFT JOIN orders o
        ON TO_CHAR(o.purchase_date, 'YYYY-MM') = TO_CHAR(gs.month, 'YYYY-MM')
        AND o.status != 'cancelled'
      GROUP BY gs.month
      ORDER BY gs.month ASC
    `, [months]);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
