'use strict';
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

let db;

function getDb() {
  if (!db) {
    const dbPath = process.env.DB_PATH || './data/crm.db';
    const dir = path.dirname(path.resolve(dbPath));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new Database(path.resolve(dbPath));
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    -- Người dùng (admin dùng app này)
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Sản phẩm
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      duration_months INTEGER NOT NULL DEFAULT 1,
      price REAL NOT NULL DEFAULT 0,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Khách hàng
    -- type: 'buyer' (đã mua) | 'lead' (tiềm năng, chưa mua)
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      zalo TEXT,
      facebook TEXT,
      type TEXT NOT NULL DEFAULT 'lead',
      source TEXT,
      interest TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Đơn hàng
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      account_email TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      price REAL NOT NULL,
      purchase_date DATE NOT NULL,
      expire_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Lịch sử bảo hành
    CREATE TABLE IF NOT EXISTS warranties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      order_id INTEGER REFERENCES orders(id),
      warranty_email TEXT,
      issue TEXT NOT NULL,
      resolution TEXT,
      warranty_date DATE NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed user admin nếu chưa có
  const admin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!admin) {
    db.prepare('INSERT INTO users (username, password_hash, full_name) VALUES (?, ?, ?)').run(
      'admin',
      bcrypt.hashSync('Admin@123', 10),
      'Administrator'
    );

    // Seed products
    const insertProduct = db.prepare('INSERT INTO products (name, duration_months, price, description) VALUES (?, ?, ?, ?)');
    insertProduct.run('Evoto Pro', 1, 150000, 'Phần mềm chỉnh ảnh AI');
    insertProduct.run('Adobe Creative Cloud', 1, 200000, 'Bộ phần mềm Adobe');
    insertProduct.run('Canva Pro', 1, 80000, 'Thiết kế đồ họa online');
    insertProduct.run('Google Drive 2TB', 12, 720000, 'Lưu trữ đám mây 2TB/năm');
    insertProduct.run('Google One 2TB', 12, 840000, 'Google One 2TB/năm');

    console.log('✅ Seed data inserted (admin / Admin@123)');
  }

  return db;
}

module.exports = { getDb, initDb };
