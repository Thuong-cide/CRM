'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../database');
const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    console.log('LOGIN attempt:', JSON.stringify({ username, password: password ? '***' : undefined, body: req.body, ct: req.headers['content-type'] }));
    if (!username || !password) return res.status(400).json({ error: 'Thiếu username/password' });

    const { rows } = await getPool().query('SELECT * FROM users WHERE username = $1', [username]);
    const user = rows[0];
    console.log('user found:', !!user, 'hash:', user?.password_hash?.substring(0,20));
    const match = user ? await bcrypt.compare(password, user.password_hash) : false;
    console.log('bcrypt match:', match);
    if (!user || !match)
      return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });

    const token = jwt.sign(
      { id: user.id, username: user.username, full_name: user.full_name },
      process.env.JWT_SECRET || 'crm-secret-2024',
      { expiresIn: '30d' }
    );
    res.json({ token, user: { id: user.id, username: user.username, full_name: user.full_name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
