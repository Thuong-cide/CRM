'use strict';
const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const auth = req.headers['authorization'];
  const token = auth && auth.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'crm-secret-2024');
    next();
  } catch {
    return res.status(401).json({ error: 'Token không hợp lệ' });
  }
}

module.exports = { authenticate };
