import { useState, useRef, useCallback, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const nav = [
  { to: '/',           label: 'Dashboard',  icon: '📊', end: true },
  { to: '/customers',  label: 'Khách hàng', icon: '👥' },
  { to: '/orders',     label: 'Đơn hàng',   icon: '📦' },
  { to: '/warranties', label: 'Bảo hành',   icon: '🔧' },
  { to: '/products',   label: 'Sản phẩm',   icon: '🛍️' },
];

/* ── Mini search bar trong header mobile ── */
function MobileSearch() {
  const [q, setQ]             = useState('');
  const [results, setResults] = useState(null);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate              = useNavigate();
  const wrapRef               = useRef(null);
  const timerRef              = useRef(null);
  const inputRef              = useRef(null);

  // Đóng khi click ngoài
  useEffect(() => {
    const handler = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback(async (val) => {
    if (val.trim().length < 2) { setResults(null); setOpen(false); return; }
    setLoading(true);
    try {
      // dynamic import để tránh vòng lặp
      const api = (await import('../api/axios')).default;
      const { data } = await api.get('/api/search', { params: { q: val } });
      setResults(data);
      setOpen(true);
    } catch {}
    finally { setLoading(false); }
  }, []);

  const handleChange = e => {
    const val = e.target.value;
    setQ(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), 300);
  };

  const go = (path) => {
    setOpen(false); setQ(''); setResults(null);
    inputRef.current?.blur();
    navigate(path);
  };

  const fmtDate = d => d ? new Date(d).toLocaleDateString('vi-VN') : '—';
  const total = results ? results.customers.length + results.orders.length + results.warranties.length : 0;

  return (
    <div ref={wrapRef} className="relative flex-1 mx-2">
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          ref={inputRef}
          className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-600 bg-gray-800 text-white text-sm placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:bg-gray-700"
          placeholder="Tìm email, KH, đơn..."
          value={q}
          onChange={handleChange}
          onFocus={() => results && setOpen(true)}
        />
        {loading && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">•••</span>}
        {q && !loading && (
          <button onClick={() => { setQ(''); setResults(null); setOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">✕</button>
        )}
      </div>

      {/* Dropdown kết quả */}
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-[75vh] overflow-y-auto">
          {total === 0 && (
            <div className="px-4 py-5 text-center text-gray-400 text-sm">Không tìm thấy "{q}"</div>
          )}

          {/* Khách hàng */}
          {results?.customers.length > 0 && (
            <div>
              <div className="px-3 py-1.5 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase">
                👥 Khách hàng ({results.customers.length})
              </div>
              {results.customers.map(c => (
                <button key={c.id} onClick={() => go(`/customers/${c.id}`)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b last:border-0 flex items-center justify-between active:bg-blue-100">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.phone || c.email || ''}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ml-2 flex-shrink-0 ${c.type === 'buyer' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-600'}`}>
                    {c.type === 'buyer' ? '✅ Đã mua' : '🎯 Tiềm năng'}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Đơn hàng */}
          {results?.orders.length > 0 && (
            <div>
              <div className="px-3 py-1.5 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase">
                📦 Đơn hàng ({results.orders.length})
              </div>
              {results.orders.map(o => {
                const days = o.expire_date ? Math.ceil((new Date(o.expire_date) - new Date()) / 86400000) : null;
                const isExpired = days !== null && days <= 0;
                return (
                  <div key={o.id} className={`border-b last:border-0 flex ${isExpired ? 'bg-red-50' : ''}`}>
                    <button onClick={() => go(`/customers/${o.customer_id}`)}
                      className="flex-1 text-left px-4 py-3 hover:bg-blue-50 active:bg-blue-100">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-gray-800">{o.customer_name}</p>
                        {isExpired && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">HẾT HẠN</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {o.product_name}
                        {o.account_email && <span className="ml-1 text-blue-600"> · {o.account_email}</span>}
                      </p>
                      <p className={`text-xs font-medium mt-0.5 ${isExpired ? 'text-red-500' : days <= 7 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {isExpired ? `Hết hạn ${Math.abs(days)}ng trước` : `còn ${days}ng · ${fmtDate(o.expire_date)}`}
                      </p>
                    </button>
                    <button
                      onClick={() => go(`/customers/${o.customer_id}?warranty=1&order_id=${o.id}&email=${encodeURIComponent(o.account_email || '')}`)}
                      className={`flex-shrink-0 px-3 flex flex-col items-center justify-center border-l text-xs font-medium ${isExpired ? 'bg-red-100 text-red-600' : 'bg-orange-50 text-orange-600'}`}
                    >
                      🔧<span className="text-[10px]">BH</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bảo hành */}
          {results?.warranties.length > 0 && (
            <div>
              <div className="px-3 py-1.5 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase">
                🔧 Bảo hành ({results.warranties.length})
              </div>
              {results.warranties.map(w => (
                <button key={w.id} onClick={() => go(`/customers/${w.customer_id}`)}
                  className="w-full text-left px-4 py-3 hover:bg-orange-50 border-b last:border-0 active:bg-orange-100">
                  <p className="text-sm font-medium text-gray-800">{w.customer_name}</p>
                  {w.warranty_email && <p className="text-xs text-blue-500">{w.warranty_email}</p>}
                  <p className="text-xs text-red-500 mt-0.5 truncate">🔴 {w.issue}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      {/* ── DESKTOP Sidebar (md+) ─────────────────────────── */}
      <aside className="hidden md:flex w-56 min-h-screen bg-gray-900 text-white flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-700">
          <div className="text-blue-400 font-bold text-lg">🦞 CRM</div>
          <div className="text-gray-400 text-xs mt-0.5">{user?.full_name || user?.username}</div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {nav.map(({ to, label, icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`
              }>
              {icon} {label}
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

      {/* ── MOBILE Top Header ─────────────────────────────── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-gray-900 text-white flex items-center px-3 py-2 shadow-lg gap-2">
        <div className="text-blue-400 font-bold text-base flex-shrink-0">🦞</div>
        <MobileSearch />
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="text-gray-400 text-xs px-2 py-1.5 rounded hover:bg-gray-700 flex-shrink-0"
        >
          🚪
        </button>
      </header>

      {/* ── MOBILE Bottom Tab Bar ─────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-gray-900 border-t border-gray-700 flex">
        {nav.map(({ to, label, icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 text-[10px] transition-colors ${
                isActive ? 'text-blue-400' : 'text-gray-400 hover:text-white'
              }`
            }>
            <span className="text-lg leading-none">{icon}</span>
            <span className="mt-0.5 font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
