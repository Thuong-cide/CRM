import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const nav = [
  { to: '/', label: '📊 Dashboard', end: true },
  { to: '/customers', label: '👥 Khách hàng' },
  { to: '/orders', label: '📦 Đơn hàng' },
  { to: '/products', label: '🛍️ Sản phẩm' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <aside className="w-56 min-h-screen bg-gray-900 text-white flex flex-col flex-shrink-0">
      <div className="p-4 border-b border-gray-700">
        <div className="text-blue-400 font-bold text-lg">🦞 CRM</div>
        <div className="text-gray-400 text-xs mt-0.5">{user?.full_name || user?.username}</div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {nav.map(({ to, label, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) =>
              `block px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`
            }>
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-gray-700">
        <button onClick={() => { logout(); navigate('/login'); }}
          className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700 rounded-lg transition">
          🚪 Đăng xuất
        </button>
      </div>
    </aside>
  );
}
