import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/api/auth/login', form);
      login(data.token, data.user);
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Đăng nhập thất bại';
      const detail = err.code || err.response?.status || '';
      toast.error(`${msg}${detail ? ' (' + detail + ')' : ''}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-gray-900 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🦞</div>
          <h1 className="text-2xl font-bold text-gray-800">CRM</h1>
          <p className="text-gray-400 text-sm">Quản lý khách hàng bản quyền</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Tên đăng nhập</label>
            <input className="input" placeholder="admin" value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })} required />
          </div>
          <div>
            <label className="label">Mật khẩu</label>
            <input type="password" className="input" placeholder="••••••••" value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })} required />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50">
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
        <p className="text-center text-xs text-gray-400 mt-4">admin / Admin@123</p>
      </div>
    </div>
  );
}
