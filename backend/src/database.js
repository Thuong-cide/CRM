'use strict';
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }
  return pool;
}

async function initDb() {
  const p = getPool();

  // ── Tạo bảng ──────────────────────────────────────────────────────────────
  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      duration_months INTEGER NOT NULL DEFAULT 1,
      price NUMERIC NOT NULL DEFAULT 0,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      zalo TEXT,
      facebook TEXT,
      type TEXT NOT NULL DEFAULT 'lead',
      source TEXT,
      interest TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMPTZ DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      account_email TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      price NUMERIC NOT NULL,
      purchase_date DATE NOT NULL,
      expire_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS warranties (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      order_id INTEGER REFERENCES orders(id),
      warranty_email TEXT,
      issue TEXT NOT NULL,
      resolution TEXT,
      warranty_date DATE NOT NULL,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ── Migrations: ADD COLUMN IF NOT EXISTS ──────────────────────────────────
  const migrations = [
    { table: 'orders',     column: 'supplier',      type: 'TEXT' },
    { table: 'orders',     column: 'cost_price',    type: 'NUMERIC' },
    { table: 'orders',     column: 'refund_amount', type: 'NUMERIC' },
    { table: 'orders',     column: 'refund_note',   type: 'TEXT' },
    { table: 'products',   column: 'cost_price',    type: 'NUMERIC' },
    { table: 'warranties', column: 'contact_email', type: 'TEXT' },
  ];

  for (const m of migrations) {
    const { rows } = await p.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name=$1 AND column_name=$2
    `, [m.table, m.column]);
    if (rows.length === 0) {
      await p.query(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.type}`);
      console.log(`✅ Migration: thêm cột ${m.column} vào ${m.table}`);
    }
  }

  // ── Seed admin + products nếu users trống ─────────────────────────────────
  const { rows: adminRows } = await p.query('SELECT id FROM users WHERE username=$1', ['admin']);
  if (adminRows.length === 0) {
    const hash = await bcrypt.hash('Admin@123', 10);
    await p.query(
      'INSERT INTO users (username, password_hash, full_name) VALUES ($1, $2, $3)',
      ['admin', hash, 'Administrator']
    );

    const products = [
      ['Evoto Pro',               1, 150000, 'Phần mềm chỉnh ảnh AI'],
      ['Adobe Creative Cloud',    1, 200000, 'Bộ phần mềm Adobe'],
      ['Canva Pro',               1,  80000, 'Thiết kế đồ họa online'],
      ['Google Drive 2TB',       12, 720000, 'Lưu trữ đám mây 2TB/năm'],
      ['Google One 2TB',         12, 840000, 'Google One 2TB/năm'],
    ];
    for (const [name, duration_months, price, description] of products) {
      await p.query(
        'INSERT INTO products (name, duration_months, price, description) VALUES ($1, $2, $3, $4)',
        [name, duration_months, price, description]
      );
    }
    console.log('✅ Seed data inserted (admin / Admin@123)');
  }

  return p;
}

module.exports = { getPool, initDb };
