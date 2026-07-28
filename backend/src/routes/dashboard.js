'use strict';
const express = require('express');
const { getDb } = require('../database');
const { authenticate } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);

router.get('/stats', (req, res) => {
  const db = getDb();
  const days = parseInt(process.env.RENEW_DAYS_BEFORE || 7);
  const totalCustomers = db.prepare("SELECT COUNT(*) as v FROM customers").get().v;
  const buyers = db.prepare("SELECT COUNT(*) as v FROM customers WHERE type='buyer'").get().v;
  const leads = db.prepare("SELECT COUNT(*) as v FROM customers WHERE type='lead'").get().v;
  const totalOrders = db.prepare("SELECT COUNT(*) as v FROM orders").get().v;
  const activeOrders = db.prepare("SELECT COUNT(*) as v FROM orders WHERE status='active'").get().v;
  const totalWarranties = db.prepare("SELECT COUNT(*) as v FROM warranties").get().v;
  const expiring = db.prepare(`
    SELECT COUNT(*) as v FROM orders
    WHERE status='active'
      AND date(expire_date) <= date('now', '+' || ? || ' days')
      AND date(expire_date) >= date('now')
  `).get(days).v;
  res.json({ totalCustomers, buyers, leads, totalOrders, activeOrders, totalWarranties, expiring, expiringDays: days });
});

module.exports = router;
