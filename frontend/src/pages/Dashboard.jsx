import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';

/* ─── Global Search ───────────────────────────────────── */
function GlobalSearch() {
  const [q, setQ]             = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);
  const navigate              = useNavigate();
  const wrapRef               = useRef(null);
  const timerRef              = useRef(null);

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

  const go = (path) => { setOpen(false); setQ(''); setResults(null); navigate(path); };

  const fmtDate = d => d ? new Date(d).toLocaleDateString('vi-VN') : '—';
  const hasResults = results && (
    results.customers.length + results.orders.length + results.warranties.length > 0
  );
  const isEmpty = results && !hasResults;

  return (
    <div ref={wrapRef} className="relative w-full">
      {/* Input */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base">🔍</span>
        <input
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
          placeholder="Tìm kiếm khách hàng, đơn hàng, mail account, mail bảo hành..."
          value={q}
          onChange={handleChange}
          onFocus={() => results && setOpen(true)}
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">...</span>
        )}
      </div>

      {/* Dropdown kết quả */}
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden max-h-[70vh] overflow-y-auto">

          {isEmpty && (
            <div className="px-4 py-6 text-center text-gray-400 text-sm">Không tìm thấy kết quả nào cho “{results.query}”</div>
          )}

          {/* Khách hàng */}
          {results?.customers.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide">
                👥 Khách hàng ({results.customers.length})
              </div>
              {results.customers.map(c => (
                <button key={c.id} onClick={() => go(`/customers/${c.id}`)}
                  className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b last:border-0 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{c.name}</p>
                    <p className="text-xs text-gray-400">
                      {c.phone && <span className="mr-2">📱 {c.phone}</span>}
                      {c.email && <span>✉️ {c.email}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.type === 'buyer' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-600'}`}>
                      {c.type === 'buyer' ? '✅ Đã mua' : '🎯 Tiềm năng'}
                    </span>
                    <span className="text-xs text-gray-400">{c.order_count} đơn</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Đơn hàng */}
          {results?.orders.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide">
                📦 Đơn hàng ({results.orders.length})
              </div>
              {results.orders.map(o => {
                const days = o.expire_date ? Math.ceil((new Date(o.expire_date) - new Date()) / 86400000) : null;
                const isExpired = days !== null && days <= 0;
                return (
                  <div key={o.id} className={`border-b last:border-0 ${
                    isExpired ? 'bg-red-50' : ''
                  }`}>
                    <div className="flex items-stretch">
                      {/* Phần info — click vào KH */}
                      <button onClick={() => go(`/customers/${o.customer_id}`)}
                        className="flex-1 text-left px-4 py-3 hover:bg-blue-50 transition-colors">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-800">{o.customer_name}</p>
                              {isExpired && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">HẾT HẠN</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              <span className="font-medium">{o.product_name}</span>
                              {o.account_email && <span className="ml-2 text-blue-600">📧 {o.account_email}</span>}
                            </p>
                            {o.supplier && (
                              <span className="text-xs text-indigo-600">🏭 {o.supplier}</span>
                            )}
                          </div>
                          <div className="ml-2 flex-shrink-0 text-right">
                            <p className="text-xs text-gray-400">{fmtDate(o.purchase_date)} → {fmtDate(o.expire_date)}</p>
                            <span className={`text-xs font-medium ${
                              isExpired ? 'text-red-500' : days <= 7 ? 'text-yellow-600' : 'text-green-600'
                            }`}>
                              {isExpired ? `Hết hạn ${Math.abs(days)}ng trước` : `còn ${days}ng`}
                            </span>
                          </div>
                        </div>
                        {isExpired && (
                          <p className="text-xs text-red-500 mt-1 font-medium">⚠️ Kiểm tra trước khi bảo hành!</p>
                        )}
                      </button>
                      {/* Nút bảo hành nhanh */}
                      <button
                        onClick={() => go(`/customers/${o.customer_id}?warranty=1&order_id=${o.id}&email=${encodeURIComponent(o.account_email || '')}`)}
                        title="Ghi bảo hành nhanh"
                        className={`flex-shrink-0 px-3 flex flex-col items-center justify-center gap-0.5 border-l transition-colors ${
                          isExpired
                            ? 'bg-red-100 hover:bg-red-200 border-red-200 text-red-600'
                            : 'bg-orange-50 hover:bg-orange-100 border-orange-100 text-orange-600'
                        }`}
                      >
                        <span className="text-base">🔧</span>
                        <span className="text-[10px] font-medium">BH ngay</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bảo hành */}
          {results?.warranties.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide">
                🔧 Bảo hành ({results.warranties.length})
              </div>
              {results.warranties.map(w => (
                <button key={w.id} onClick={() => go(`/customers/${w.customer_id}`)}
                  className="w-full text-left px-4 py-3 hover:bg-orange-50 border-b last:border-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{w.customer_name}</p>
                      <p className="text-xs text-gray-500">
                        {w.product_name && <span className="mr-1">{w.product_name}</span>}
                        {w.warranty_email && <span className="text-orange-600">📧 {w.warranty_email}</span>}
                      </p>
                      <p className="text-xs text-red-500 mt-0.5 truncate max-w-xs">🔴 {w.issue}</p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{fmtDate(w.warranty_date)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Link xem tất cả */}
          {hasResults && (
            <div className="px-4 py-2 border-t bg-gray-50 text-center">
              <button onClick={() => { setOpen(false); }}
                className="text-xs text-gray-400 hover:text-gray-600">
                Nhấn ESC để đóng
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Mini SVG Bar Chart ─────────────────────────────────────── */
function RevenueChart({ data }) {
  if (!data || data.length === 0) return null;
  const W = 560, H = 160, PAD = { top: 12, right: 8, bottom: 32, left: 56 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(...data.map(d => d.revenue), 1);
  const barW   = Math.floor(innerW / data.length * 0.6);
  const gap    = innerW / data.length;
  const fmt    = v => v >= 1_000_000 ? (v / 1_000_000).toFixed(1) + 'M' : v >= 1_000 ? (v / 1_000).toFixed(0) + 'K' : v;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none">
      {/* Y grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = PAD.top + innerH * (1 - t);
        return (
          <g key={t}>
            <line x1={PAD.left} y1={y} x2={PAD.left + innerW} y2={y} stroke="#e5e7eb" strokeDasharray="3 3" />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">
              {fmt(maxVal * t)}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const barH  = Math.max((d.revenue / maxVal) * innerH, d.revenue > 0 ? 2 : 0);
        const x     = PAD.left + i * gap + (gap - barW) / 2;
        const y     = PAD.top + innerH - barH;
        const label = d.month.slice(5); // MM
        return (
          <g key={d.month}>
            <rect x={x} y={y} width={barW} height={barH} rx={3} fill={barH > 0 ? '#3b82f6' : '#e5e7eb'} opacity={0.85} />
            {d.revenue > 0 && (
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={8} fill="#6b7280">
                {fmt(d.revenue)}
              </text>
            )}
            <text x={x + barW / 2} y={PAD.top + innerH + 16} textAnchor="middle" fontSize={9} fill="#6b7280">
              T{label}
            </text>
            {d.order_count > 0 && (
              <text x={x + barW / 2} y={PAD.top + innerH + 26} textAnchor="middle" fontSize={8} fill="#9ca3af">
                {d.order_count}đ
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ─── Stat Card ──────────────────────────────────────────────── */
function StatCard({ label, value, icon, color, to }) {
  const inner = (
    <div className={`card border-l-4 ${color} hover:shadow-md transition cursor-pointer`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{value ?? '—'}</p>
        </div>
        <span className="text-3xl">{icon}</span>
      </div>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

/* ─── Quick-Order form initial state ─────────────────────────── */
const EMPTY_ORDER = {
  customer_search: '', customer_id: '',
  customer_name_new: '', customer_phone_new: '', customer_email_new: '',
  product_id: '', account_email: '', price: '', cost_price: '', supplier: '',
  purchase_date: new Date().toISOString().split('T')[0],
  expire_date: '', notes: '',
};

/* ─── Renew Modal ────────────────────────────────────────────── */
function RenewModal({ order, products, onClose, onDone }) {
  const today  = new Date().toISOString().split('T')[0];
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [expireDate, setExpireDate]     = useState('');
  const [price, setPrice]               = useState(String(order.price || ''));
  const [costPrice, setCostPrice]       = useState(String(order.cost_price || ''));
  const [supplier, setSupplier]         = useState(order.supplier || '');
  const [notes, setNotes]               = useState('');
  const [saving, setSaving]             = useState(false);

  // Auto-calc expire khi load
  useEffect(() => {
    const p = products.find(x => x.id === order.product_id);
    if (!p) return;
    const d = new Date(today);
    d.setMonth(d.getMonth() + p.duration_months);
    setExpireDate(d.toISOString().split('T')[0]);
  }, []);

  const handlePurchaseDateChange = (date) => {
    setPurchaseDate(date);
    const p = products.find(x => x.id === order.product_id);
    if (!p) return;
    const d = new Date(date);
    d.setMonth(d.getMonth() + p.duration_months);
    setExpireDate(d.toISOString().split('T')[0]);
  };

  const save = async () => {
    if (!purchaseDate || !expireDate || !price) return toast.error('Điền đầy đủ thông tin');
    setSaving(true);
    try {
      // 1. Đổi đơn cũ → renewed
      await api.put(`/api/orders/${order.id}`, { status: 'renewed' });
      // 2. Tạo đơn mới
      await api.post('/api/orders', {
        customer_id:   order.customer_id,
        product_id:    order.product_id,
        account_email: order.account_email || null,
        price, cost_price: costPrice || null,
        supplier: supplier || null,
        quantity: 1,
        purchase_date: purchaseDate,
        expire_date:   expireDate,
        notes: notes || null,
      });
      toast.success('✅ Đã gia hạn thành công!');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi khi gia hạn');
    } finally { setSaving(false); }
  };

  const fmtMoney = v => v ? new Intl.NumberFormat('vi-VN').format(v) + 'đ' : '';

  return (
    <Modal title="🔄 Gia hạn đơn hàng" onClose={onClose}>
      <div className="space-y-4">
        {/* Info đơn cũ */}
        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 space-y-1">
          <p><span className="font-medium">Khách hàng:</span> {order.customer_name}</p>
          <p><span className="font-medium">Sản phẩm:</span> {order.product_name}</p>
          {order.account_email && <p><span className="font-medium">Account:</span> {order.account_email}</p>}
          <p className="text-xs text-gray-400">→ Đơn cũ sẽ được đánh dấu "Gia hạn" và tạo đơn mới</p>
        </div>

        {/* Ngày mua mới */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Ngày mua mới *</label>
            <input type="date" className="input" value={purchaseDate}
              onChange={e => handlePurchaseDateChange(e.target.value)} />
          </div>
          <div>
            <label className="label">Ngày hết hạn mới *</label>
            <input type="date" className="input" value={expireDate}
              onChange={e => setExpireDate(e.target.value)} />
          </div>
        </div>

        {/* Giá */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Giá bán (VNĐ) *</label>
            <input type="number" className="input" value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder={fmtMoney(order.price)} />
          </div>
          <div>
            <label className="label">Giá nhập (VNĐ)</label>
            <input type="number" className="input" value={costPrice}
              onChange={e => setCostPrice(e.target.value)}
              placeholder={order.cost_price ? fmtMoney(order.cost_price) : '0'} />
            {price && costPrice && (
              <p className="text-xs mt-1 font-medium text-emerald-600">
                Lợi nhuận: {new Intl.NumberFormat('vi-VN').format((parseFloat(price)||0) - (parseFloat(costPrice)||0))}đ
              </p>
            )}
          </div>
        </div>

        {/* Nguồn cung */}
        <div>
          <label className="label">Nguồn cung</label>
          <input className="input" value={supplier} onChange={e => setSupplier(e.target.value)}
            placeholder={order.supplier || 'Nguồn A, Nguồn B...'} />
          {order.supplier && (
            <p className="text-xs text-indigo-500 mt-1">🏭 Đơn cũ từ: <strong>{order.supplier}</strong></p>
          )}
        </div>

        {/* Ghi chú */}
        <div>
          <label className="label">Ghi chú</label>
          <input className="input" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="VD: gia hạn tháng 8..." />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <button onClick={onClose} className="btn-secondary">Hủy</button>
          <button onClick={save} disabled={saving}
            className="btn-primary px-6 disabled:opacity-50">
            {saving ? 'Đang lưu...' : '🔄 Xác nhận gia hạn'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Dashboard ──────────────────────────────────────────────── */
export default function Dashboard() {
  const [stats, setStats]             = useState(null);
  const [expiring, setExpiring]       = useState([]);
  const [revenue, setRevenue]         = useState([]);
  const [products, setProducts]       = useState([]);
  const [customerResults, setCustomerResults] = useState([]);
  const [showModal, setShowModal]     = useState(false);
  const [renewOrder, setRenewOrder]   = useState(null); // order đang gia hạn
  const [form, setForm]               = useState(EMPTY_ORDER);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searching, setSearching]     = useState(false);
  const [saving, setSaving]           = useState(false);

  const loadDashboard = async () => {
    try {
      const [s, e, r] = await Promise.all([
        api.get('/api/dashboard/stats'),
        api.get('/api/orders/expiring'),
        api.get('/api/dashboard/revenue', { params: { months: 6 } }),
      ]);
      setStats(s.data);
      setExpiring(e.data);
      setRevenue(r.data);
    } catch {}
  };

  useEffect(() => {
    loadDashboard();
    api.get('/api/products').then(r => setProducts(r.data)).catch(() => {});
  }, []);

  /* ── Customer search ── */
  const searchCustomer = async (q) => {
    setForm(f => ({ ...f, customer_search: q, customer_id: '', customer_name_new: '', customer_phone_new: '', customer_email_new: '' }));
    setSelectedCustomer(null);
    if (!q.trim() || q.length < 2) { setCustomerResults([]); return; }
    setSearching(true);
    try {
      const { data } = await api.get('/api/customers', { params: { search: q, limit: 8 } });
      setCustomerResults(data.data);
    } finally { setSearching(false); }
  };

  const selectCustomer = (c) => {
    setSelectedCustomer(c);
    setForm(f => ({ ...f, customer_search: c.name + (c.phone ? ` - ${c.phone}` : ''), customer_id: c.id }));
    setCustomerResults([]);
  };

  const selectNewCustomer = () => {
    setSelectedCustomer('new');
    setForm(f => ({ ...f, customer_name_new: f.customer_search.trim(), customer_id: '' }));
    setCustomerResults([]);
  };

  const handleProductChange = (pid) => {
    const p = products.find(x => x.id === parseInt(pid));
    if (!p) return setForm(f => ({ ...f, product_id: pid }));
    const d = new Date(form.purchase_date || new Date());
    d.setMonth(d.getMonth() + p.duration_months);
    setForm(f => ({
      ...f,
      product_id:  pid,
      price:       p.price,
      cost_price:  p.cost_price ?? '',
      expire_date: d.toISOString().split('T')[0],
    }));
  };

  const handlePurchaseDateChange = (date) => {
    setForm(f => {
      const p = products.find(x => x.id === parseInt(f.product_id));
      if (!p) return { ...f, purchase_date: date };
      const d = new Date(date);
      d.setMonth(d.getMonth() + p.duration_months);
      return { ...f, purchase_date: date, expire_date: d.toISOString().split('T')[0] };
    });
  };

  const openModal = () => {
    setForm(EMPTY_ORDER); setSelectedCustomer(null); setCustomerResults([]); setShowModal(true);
  };

  /* ── Save quick order ── */
  const save = async () => {
    if (!selectedCustomer) return toast.error('Chọn hoặc nhập khách hàng');
    if (selectedCustomer === 'new' && !form.customer_name_new.trim()) return toast.error('Nhập tên khách hàng mới');
    if (!form.product_id) return toast.error('Chọn sản phẩm');
    if (!form.price) return toast.error('Nhập giá');
    if (!form.purchase_date || !form.expire_date) return toast.error('Nhập ngày mua và ngày hết hạn');
    setSaving(true);
    try {
      let customerId = form.customer_id;
      if (selectedCustomer === 'new') {
        const { data } = await api.post('/api/customers', {
          name: form.customer_name_new.trim(),
          phone: form.customer_phone_new || null,
          email: form.customer_email_new || null,
          type: 'buyer',
        });
        customerId = data.id;
        toast.success(`Đã tạo khách hàng "${form.customer_name_new}"`);
      }
      await api.post('/api/orders', {
        customer_id:   customerId,
        product_id:    form.product_id,
        account_email: form.account_email || null,
        price:         form.price,
        cost_price:    form.cost_price || null,
        supplier:      form.supplier || null,
        quantity:      1,
        purchase_date: form.purchase_date,
        expire_date:   form.expire_date,
        notes:         form.notes || null,
      });
      toast.success('✅ Đã tạo đơn hàng!');
      setShowModal(false);
      loadDashboard();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi khi lưu');
    } finally { setSaving(false); }
  };

  const fmtDate  = d => d ? new Date(d).toLocaleDateString('vi-VN') : '—';
  const daysLeft = d => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null;
  const totalRevenue = revenue.reduce((s, r) => s + r.revenue, 0);
  const fmtMoney = v => new Intl.NumberFormat('vi-VN').format(v) + 'đ';

  return (
    <div className="p-3 md:p-6 max-w-6xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">📊 Dashboard</h2>
        {/* Nút thêm đơn — desktop */}
        <button onClick={openModal} className="btn-primary hidden md:inline-flex items-center gap-1">
          ⚡ Thêm đơn hàng nhanh
        </button>
      </div>

      {/* FAB — mobile only */}
      <button
        onClick={openModal}
        className="md:hidden fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center text-2xl active:bg-blue-700"
        title="Thêm đơn hàng nhanh"
      >
        ⚡
      </button>

      {/* ── Tìm kiếm toàn cục — chỉ hiện trên desktop (mobile đã có trong header) ── */}
      <div className="mb-5 hidden md:block">
        <GlobalSearch />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <StatCard label="Khách đã mua"    value={stats?.buyers}         icon="✅" color="border-green-500"  to="/customers?type=buyer" />
        <StatCard label="Khách tiềm năng" value={stats?.leads}          icon="🎯" color="border-blue-400"   to="/customers?type=lead" />
        <StatCard label="Đơn đang active" value={stats?.activeOrders}   icon="📦" color="border-indigo-500" to="/orders" />
        <StatCard label="Lần bảo hành"    value={stats?.totalWarranties} icon="🔧" color="border-purple-500" />
      </div>

      {/* Doanh thu & lợi nhuận tháng này */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="card border-l-4 border-green-400">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Doanh thu tháng này</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{new Intl.NumberFormat('vi-VN').format(stats.revenueThisMonth)}đ</p>
          </div>
          <div className="card border-l-4 border-emerald-500">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Lợi nhuận tháng này</p>
            <p className={`text-2xl font-bold mt-1 ${stats.profitThisMonth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {stats.profitThisMonth > 0 ? '+' : ''}{new Intl.NumberFormat('vi-VN').format(stats.profitThisMonth)}đ
            </p>
            <p className="text-xs text-gray-400 mt-1">chỉ tính đơn có nhập giá nhập</p>
          </div>
        </div>
      )}

      {/* Revenue chart — ẩn trên mobile */}
      <div className="bg-white rounded-xl shadow-sm border p-4 md:p-5 mb-6 hidden md:block">
        <div className="flex justify-between items-baseline mb-3">
          <h3 className="font-semibold text-gray-700">📈 Doanh thu 6 tháng gần nhất</h3>
          <span className="text-sm text-green-600 font-medium">
            Tổng: {fmtMoney(totalRevenue)}
          </span>
        </div>
        <RevenueChart data={revenue} />
        {revenue.some(r => r.profit > 0) && (
          <p className="text-xs text-gray-400 mt-1">📊 Cột xanh = doanh thu · 🟢 Lợi nhuận chỉ tính đơn có giá nhập</p>
        )}
        {revenue.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">Chưa có dữ liệu doanh thu</div>
        )}
      </div>

      {/* Banner gia hạn */}
      {expiring.length > 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-300 rounded-xl p-4">
          <h3 className="font-semibold text-yellow-800 mb-3">
            ⚠️ {expiring.length} đơn sắp hết hạn trong {stats?.expiringDays || 7} ngày tới
          </h3>
          <div className="space-y-2">
            {expiring.map(o => {
              const days   = daysLeft(o.expire_date);
              const urgent = days !== null && days <= 2;
              const zaloNum = o.customer_phone ? o.customer_phone.replace(/^0/, '84').replace(/\D/g, '') : null;
              return (
                <div key={o.id}
                  className={`text-sm rounded-lg px-3 py-2.5 ${urgent ? 'bg-red-100 border border-red-200' : 'bg-yellow-100 border border-yellow-200'}`}>
                  {/* Row 1: tên KH + sản phẩm + số ngày */}
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <div className="flex items-center gap-1 flex-wrap">
                      <Link to={`/customers/${o.customer_id}`} className="font-medium text-blue-700 hover:underline">
                        {o.customer_name}
                      </Link>
                      <span className="text-gray-500">—</span>
                      <span className="text-gray-600">{o.product_name}</span>
                      {o.account_email && <span className="text-gray-400 text-xs">({o.account_email})</span>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`font-semibold text-xs ${urgent ? 'text-red-600' : 'text-yellow-700'}`}>
                        {days === 0 ? 'Hôm nay!' : days < 0 ? 'Đã hết' : `còn ${days} ngày`}
                      </span>
                      <span className="text-gray-400 text-xs">{fmtDate(o.expire_date)}</span>
                    </div>
                  </div>
                  {/* Row 2: nút liên hệ + gia hạn */}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {/* Gọi điện */}
                    {o.customer_phone && (
                      <a
                        href={`tel:${o.customer_phone}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition"
                        title={`Gọi ${o.customer_phone}`}
                      >
                        📞 Gọi
                      </a>
                    )}
                    {/* Zalo */}
                    {zaloNum && (
                      <a
                        href={`https://zalo.me/${zaloNum}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium transition"
                        title={`Zalo ${o.customer_phone}`}
                      >
                        💬 Zalo
                      </a>
                    )}
                    {/* Email KH */}
                    {o.customer_email && (
                      <a
                        href={`mailto:${o.customer_email}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-xs font-medium transition"
                        title={`Email ${o.customer_email}`}
                      >
                        ✉️ Email
                      </a>
                    )}
                    {/* Gia hạn */}
                    <button
                      onClick={() => setRenewOrder(o)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition"
                    >
                      🔄 Gia hạn
                    </button>
                    {/* SĐT text nhỏ nếu không có nút gọi */}
                    {!o.customer_phone && !o.customer_email && (
                      <span className="text-gray-400 text-xs italic">Chưa có thông tin liên hệ</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {expiring.length === 0 && stats && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 text-sm">
          ✅ Không có đơn nào sắp hết hạn trong {stats.expiringDays} ngày tới
        </div>
      )}

      {/* Modal thêm đơn nhanh */}
      {showModal && (
        <Modal title="⚡ Thêm đơn hàng nhanh" onClose={() => setShowModal(false)} size="lg">
          <div className="space-y-4">
            {/* Tìm KH */}
            <div>
              <label className="label">Khách hàng *</label>
              <div className="relative">
                <input className="input"
                  placeholder="Gõ tên, SĐT, email để tìm... hoặc nhập tên KH mới"
                  value={form.customer_search}
                  onChange={e => searchCustomer(e.target.value)}
                  autoFocus />
                {searching && <div className="absolute right-3 top-2.5 text-gray-400 text-xs">Đang tìm...</div>}
                {(customerResults.length > 0 || (form.customer_search.length >= 2 && !selectedCustomer)) && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-auto">
                    {customerResults.map(c => (
                      <button key={c.id} onClick={() => selectCustomer(c)}
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm border-b last:border-0">
                        <span className="font-medium">{c.name}</span>
                        {c.phone && <span className="text-gray-400 ml-2">{c.phone}</span>}
                        {c.email && <span className="text-gray-400 ml-2">{c.email}</span>}
                        <span className={`ml-2 text-xs ${c.type === 'buyer' ? 'text-green-600' : 'text-blue-500'}`}>
                          {c.type === 'buyer' ? '✅ đã mua' : '🎯 tiềm năng'}
                        </span>
                      </button>
                    ))}
                    {form.customer_search.trim().length >= 2 && (
                      <button onClick={selectNewCustomer}
                        className="w-full text-left px-4 py-2.5 hover:bg-green-50 text-sm text-green-700 font-medium border-t">
                        ➕ Tạo khách hàng mới: "{form.customer_search.trim()}"
                      </button>
                    )}
                  </div>
                )}
              </div>
              {selectedCustomer && selectedCustomer !== 'new' && (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 flex justify-between items-center">
                  <span>✅ {selectedCustomer.name} {selectedCustomer.phone ? `• ${selectedCustomer.phone}` : ''}</span>
                  <button onClick={() => { setSelectedCustomer(null); setForm(f => ({ ...f, customer_search: '', customer_id: '' })); }}
                    className="text-gray-400 hover:text-gray-600">✕</button>
                </div>
              )}
              {selectedCustomer === 'new' && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                  <p className="text-xs font-medium text-blue-700">➕ Tạo khách hàng mới</p>
                  <div className="grid grid-cols-3 gap-2">
                    <input className="input text-xs col-span-1" placeholder="Tên *" value={form.customer_name_new}
                      onChange={e => setForm(f => ({ ...f, customer_name_new: e.target.value }))} />
                    <input className="input text-xs" placeholder="SĐT" value={form.customer_phone_new}
                      onChange={e => setForm(f => ({ ...f, customer_phone_new: e.target.value }))} />
                    <input className="input text-xs" placeholder="Email" value={form.customer_email_new}
                      onChange={e => setForm(f => ({ ...f, customer_email_new: e.target.value }))} />
                  </div>
                  <button onClick={() => { setSelectedCustomer(null); setForm(f => ({ ...f, customer_search: '', customer_id: '' })); }}
                    className="text-xs text-gray-400 hover:text-gray-600">✕ Hủy tạo mới</button>
                </div>
              )}
            </div>

            {/* Sản phẩm */}
            <div>
              <label className="label">Sản phẩm *</label>
              <select className="input" value={form.product_id} onChange={e => handleProductChange(e.target.value)}>
                <option value="">— Chọn sản phẩm —</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {new Intl.NumberFormat('vi-VN').format(p.price)}đ / {p.duration_months} tháng
                  </option>
                ))}
              </select>
            </div>

            {/* Account */}
            <div>
              <label className="label">Mail account giao cho KH</label>
              <input className="input" placeholder="account@gmail.com" value={form.account_email}
                onChange={e => setForm(f => ({ ...f, account_email: e.target.value }))} />
            </div>

            {/* Nguồn cung */}
            <div>
              <label className="label">Nguồn cung</label>
              <input className="input" placeholder="Nguồn A, Nguồn B..." value={form.supplier}
                onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} />
            </div>

            {/* Giá bán + Giá nhập */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Giá bán (VNĐ) *</label>
                <input type="number" className="input" placeholder="150000" value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div>
                <label className="label">Giá nhập (VNĐ)</label>
                <input type="number" className="input" placeholder="100000" value={form.cost_price}
                  onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))} />
                {form.price && form.cost_price && (
                  <p className="text-xs mt-1 font-medium text-emerald-600">
                    Lợi nhuận: {new Intl.NumberFormat('vi-VN').format((parseFloat(form.price)||0) - (parseFloat(form.cost_price)||0))}đ
                  </p>
                )}
              </div>
            </div>

            {/* Ngày mua + Ngày hết hạn */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Ngày mua *</label>
                <input type="date" className="input" value={form.purchase_date}
                  onChange={e => handlePurchaseDateChange(e.target.value)} />
              </div>
              <div>
                <label className="label">Ngày hết hạn *</label>
                <input type="date" className="input" value={form.expire_date}
                  onChange={e => setForm(f => ({ ...f, expire_date: e.target.value }))} />
              </div>
            </div>

            {/* Ghi chú */}
            <div>
              <label className="label">Ghi chú</label>
              <input className="input" placeholder="Ghi chú thêm..." value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Hủy</button>
              <button onClick={save} disabled={saving} className="btn-primary px-6 disabled:opacity-50">
                {saving ? 'Đang lưu...' : '💾 Lưu đơn hàng'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal gia hạn nhanh */}
      {renewOrder && (
        <RenewModal
          order={renewOrder}
          products={products}
          onClose={() => setRenewOrder(null)}
          onDone={() => { setRenewOrder(null); loadDashboard(); }}
        />
      )}
    </div>
  );
}
