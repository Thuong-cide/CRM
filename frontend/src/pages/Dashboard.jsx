import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';

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

const EMPTY_ORDER = {
  // KH
  customer_search: '',
  customer_id: '',
  customer_name_new: '',
  customer_phone_new: '',
  customer_email_new: '',
  // Đơn
  product_id: '',
  account_email: '',
  price: '',
  purchase_date: new Date().toISOString().split('T')[0],
  expire_date: '',
  notes: '',
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [expiring, setExpiring] = useState([]);
  const [products, setProducts] = useState([]);
  const [customerResults, setCustomerResults] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_ORDER);
  const [selectedCustomer, setSelectedCustomer] = useState(null); // null = chưa chọn, {} = tạo mới
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadDashboard = async () => {
    try {
      const [s, e] = await Promise.all([
        api.get('/api/dashboard/stats'),
        api.get('/api/orders/expiring'),
      ]);
      setStats(s.data);
      setExpiring(e.data);
    } catch {}
  };

  useEffect(() => {
    loadDashboard();
    api.get('/api/products').then(r => setProducts(r.data)).catch(() => {});
  }, []);

  // Tìm KH khi gõ
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
    // Dùng text đã gõ làm tên KH mới
    setSelectedCustomer('new');
    setForm(f => ({ ...f, customer_name_new: f.customer_search.trim(), customer_id: '' }));
    setCustomerResults([]);
  };

  const handleProductChange = (pid) => {
    const p = products.find(x => x.id === parseInt(pid));
    if (!p) return setForm(f => ({ ...f, product_id: pid }));
    // Tự tính expire từ ngày mua
    const d = new Date(form.purchase_date || new Date());
    d.setMonth(d.getMonth() + p.duration_months);
    const expire = d.toISOString().split('T')[0];
    setForm(f => ({ ...f, product_id: pid, price: p.price, expire_date: expire }));
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
    setForm(EMPTY_ORDER);
    setSelectedCustomer(null);
    setCustomerResults([]);
    setShowModal(true);
  };

  const save = async () => {
    // Validate
    if (!selectedCustomer) return toast.error('Chọn hoặc nhập khách hàng');
    if (selectedCustomer === 'new' && !form.customer_name_new.trim()) return toast.error('Nhập tên khách hàng mới');
    if (!form.product_id) return toast.error('Chọn sản phẩm');
    if (!form.price) return toast.error('Nhập giá');
    if (!form.purchase_date || !form.expire_date) return toast.error('Nhập ngày mua và ngày hết hạn');

    setSaving(true);
    try {
      let customerId = form.customer_id;

      // Tạo KH mới nếu chưa có
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

      // Tạo đơn hàng
      await api.post('/api/orders', {
        customer_id: customerId,
        product_id: form.product_id,
        account_email: form.account_email || null,
        price: form.price,
        quantity: 1,
        purchase_date: form.purchase_date,
        expire_date: form.expire_date,
        notes: form.notes || null,
      });

      toast.success('✅ Đã tạo đơn hàng!');
      setShowModal(false);
      loadDashboard();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi khi lưu');
    } finally {
      setSaving(false);
    }
  };

  const fmtDate = d => d ? new Date(d).toLocaleDateString('vi-VN') : '—';
  const daysLeft = d => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null;

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-xl font-bold text-gray-800">📊 Dashboard</h2>
        <button onClick={openModal} className="btn-primary text-base px-5 py-2.5">
          ⚡ Thêm đơn hàng nhanh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Khách đã mua" value={stats?.buyers} icon="✅" color="border-green-500" to="/customers?type=buyer" />
        <StatCard label="Khách tiềm năng" value={stats?.leads} icon="🎯" color="border-blue-400" to="/customers?type=lead" />
        <StatCard label="Đơn đang active" value={stats?.activeOrders} icon="📦" color="border-indigo-500" to="/orders" />
        <StatCard label="Lần bảo hành" value={stats?.totalWarranties} icon="🔧" color="border-purple-500" />
      </div>

      {/* Banner gia hạn */}
      {expiring.length > 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-300 rounded-xl p-4">
          <h3 className="font-semibold text-yellow-800 mb-3">
            ⚠️ {expiring.length} đơn sắp hết hạn trong {stats?.expiringDays || 7} ngày tới
          </h3>
          <div className="space-y-2">
            {expiring.map(o => {
              const days = daysLeft(o.expire_date);
              const urgent = days !== null && days <= 2;
              return (
                <div key={o.id} className={`flex items-center justify-between text-sm rounded-lg px-3 py-2 ${urgent ? 'bg-red-100 border border-red-200' : 'bg-yellow-100 border border-yellow-200'}`}>
                  <div>
                    <Link to={`/customers/${o.customer_id}`} className="font-medium text-blue-700 hover:underline">{o.customer_name}</Link>
                    <span className="text-gray-500 mx-2">—</span>
                    <span className="text-gray-600">{o.product_name}</span>
                    {o.account_email && <span className="text-gray-400 text-xs ml-2">({o.account_email})</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`font-semibold ${urgent ? 'text-red-600' : 'text-yellow-700'}`}>
                      {days === 0 ? 'Hôm nay!' : days < 0 ? 'Đã hết' : `còn ${days} ngày`}
                    </span>
                    <span className="text-gray-400 text-xs">{fmtDate(o.expire_date)}</span>
                    {o.customer_phone && <span className="text-gray-500 text-xs">{o.customer_phone}</span>}
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
                <input
                  className="input"
                  placeholder="Gõ tên, SĐT, email để tìm... hoặc nhập tên KH mới"
                  value={form.customer_search}
                  onChange={e => searchCustomer(e.target.value)}
                  autoFocus
                />
                {searching && <div className="absolute right-3 top-2.5 text-gray-400 text-xs">Đang tìm...</div>}

                {/* Dropdown kết quả */}
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
                    {/* Option tạo mới */}
                    {form.customer_search.trim().length >= 2 && (
                      <button onClick={selectNewCustomer}
                        className="w-full text-left px-4 py-2.5 hover:bg-green-50 text-sm text-green-700 font-medium border-t">
                        ➕ Tạo khách hàng mới: "{form.customer_search.trim()}"
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Đã chọn KH cũ */}
              {selectedCustomer && selectedCustomer !== 'new' && (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 flex justify-between items-center">
                  <span>✅ {selectedCustomer.name} {selectedCustomer.phone ? `• ${selectedCustomer.phone}` : ''}</span>
                  <button onClick={() => { setSelectedCustomer(null); setForm(f => ({...f, customer_search: '', customer_id: ''})); }} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>
              )}

              {/* Form KH mới */}
              {selectedCustomer === 'new' && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                  <p className="text-xs font-medium text-blue-700">➕ Tạo khách hàng mới</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <input className="input text-xs" placeholder="Tên *" value={form.customer_name_new}
                        onChange={e => setForm(f => ({...f, customer_name_new: e.target.value}))} />
                    </div>
                    <div>
                      <input className="input text-xs" placeholder="SĐT" value={form.customer_phone_new}
                        onChange={e => setForm(f => ({...f, customer_phone_new: e.target.value}))} />
                    </div>
                    <div>
                      <input className="input text-xs" placeholder="Email" value={form.customer_email_new}
                        onChange={e => setForm(f => ({...f, customer_email_new: e.target.value}))} />
                    </div>
                  </div>
                  <button onClick={() => { setSelectedCustomer(null); setForm(f => ({...f, customer_search: '', customer_id: ''})); }} className="text-xs text-gray-400 hover:text-gray-600">✕ Hủy tạo mới</button>
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

            {/* Mail account */}
            <div>
              <label className="label">Mail account giao cho KH</label>
              <input className="input" placeholder="account@gmail.com" value={form.account_email}
                onChange={e => setForm(f => ({...f, account_email: e.target.value}))} />
            </div>

            {/* Ngày + giá */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Ngày mua *</label>
                <input type="date" className="input" value={form.purchase_date}
                  onChange={e => handlePurchaseDateChange(e.target.value)} />
              </div>
              <div>
                <label className="label">Ngày hết hạn *</label>
                <input type="date" className="input" value={form.expire_date}
                  onChange={e => setForm(f => ({...f, expire_date: e.target.value}))} />
              </div>
              <div>
                <label className="label">Giá (VNĐ) *</label>
                <input type="number" className="input" placeholder="150000" value={form.price}
                  onChange={e => setForm(f => ({...f, price: e.target.value}))} />
              </div>
            </div>

            {/* Ghi chú */}
            <div>
              <label className="label">Ghi chú</label>
              <input className="input" placeholder="Ghi chú thêm..." value={form.notes}
                onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
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
    </div>
  );
}
