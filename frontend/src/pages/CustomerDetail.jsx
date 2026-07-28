import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orderModal, setOrderModal] = useState(false);
  const [warrantyModal, setWarrantyModal] = useState(false);
  const [orderForm, setOrderForm] = useState({ product_id: '', account_email: '', quantity: 1, price: '', purchase_date: new Date().toISOString().split('T')[0], expire_date: '', notes: '' });
  const [warrantyForm, setWarrantyForm] = useState({ order_id: '', warranty_email: '', issue: '', resolution: '', warranty_date: new Date().toISOString().split('T')[0], notes: '' });

  const fetchCustomer = async () => {
    try {
      const { data } = await api.get(`/api/customers/${id}`);
      setCustomer(data);
    } catch { toast.error('Không tìm thấy khách hàng'); navigate('/customers'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchCustomer();
    api.get('/api/products').then(r => setProducts(r.data)).catch(() => {});
  }, [id]);

  const autoExpire = (productId, purchaseDate) => {
    const p = products.find(x => x.id === parseInt(productId));
    if (!p || !purchaseDate) return '';
    const d = new Date(purchaseDate);
    d.setMonth(d.getMonth() + p.duration_months);
    return d.toISOString().split('T')[0];
  };

  const handleProductChange = (pid) => {
    const p = products.find(x => x.id === parseInt(pid));
    const expire = autoExpire(pid, orderForm.purchase_date);
    setOrderForm({ ...orderForm, product_id: pid, price: p ? p.price : '', expire_date: expire });
  };

  const saveOrder = async () => {
    const { product_id, price, purchase_date, expire_date } = orderForm;
    if (!product_id || !price || !purchase_date || !expire_date)
      return toast.error('Điền đủ: sản phẩm, giá, ngày mua, ngày hết hạn');
    try {
      await api.post('/api/orders', { ...orderForm, customer_id: id });
      toast.success('Đã thêm đơn hàng'); setOrderModal(false);
      fetchCustomer();
    } catch (err) { toast.error(err.response?.data?.error || 'Lỗi'); }
  };

  const saveWarranty = async () => {
    const { issue, warranty_date } = warrantyForm;
    if (!issue || !warranty_date) return toast.error('Điền mô tả vấn đề và ngày bảo hành');
    try {
      await api.post('/api/warranties', { ...warrantyForm, customer_id: id });
      toast.success('Đã ghi bảo hành'); setWarrantyModal(false);
      fetchCustomer();
    } catch (err) { toast.error(err.response?.data?.error || 'Lỗi'); }
  };

  const updateOrderStatus = async (orderId, status) => {
    await api.put(`/api/orders/${orderId}`, { status });
    toast.success('Đã cập nhật'); fetchCustomer();
  };

  const fmtDate = d => d ? new Date(d).toLocaleDateString('vi-VN') : '—';
  const fmtMoney = v => v ? new Intl.NumberFormat('vi-VN').format(v) + 'đ' : '—';

  const daysLeft = d => {
    if (!d) return null;
    return Math.ceil((new Date(d) - new Date()) / 86400000);
  };

  const expireStyle = (order) => {
    if (order.status !== 'active') return 'badge-expired';
    const days = daysLeft(order.expire_date);
    if (days === null) return '';
    if (days <= 0) return 'badge-expired';
    if (days <= 7) return 'badge-expiring';
    return 'badge-active';
  };

  if (loading) return <div className="p-8 text-gray-400">Đang tải...</div>;
  if (!customer) return null;

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <Link to="/customers" className="text-blue-500 text-sm hover:underline">← Danh sách khách hàng</Link>
          <h2 className="text-2xl font-bold text-gray-800 mt-1">{customer.name}</h2>
          <div className="flex items-center gap-3 mt-1">
            <span className={customer.type === 'buyer' ? 'badge-buyer' : 'badge-lead'}>
              {customer.type === 'buyer' ? '✅ Đã mua' : '🎯 Tiềm năng'}
            </span>
            <span className="text-gray-400 text-sm">{customer.order_count} đơn • {customer.warranty_count} lần bảo hành</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setWarrantyModal(true)} className="btn-secondary">🔧 Ghi bảo hành</button>
          <button onClick={() => setOrderModal(true)} className="btn-primary">+ Thêm đơn hàng</button>
        </div>
      </div>

      {/* Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-gray-700 mb-3">📋 Thông tin liên hệ</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              ['SĐT', customer.phone],
              ['Email', customer.email],
              ['Zalo', customer.zalo],
              ['Facebook', customer.facebook],
              ['Nguồn', customer.source],
              ['Quan tâm', customer.interest],
              ['Mua đầu tiên', fmtDate(customer.first_purchase)],
            ].map(([k, v]) => v ? (
              <div key={k}><span className="text-gray-400">{k}:</span> <span className="text-gray-700 font-medium">{v}</span></div>
            ) : null)}
          </div>
          {customer.notes && (
            <div className="mt-3 p-3 bg-yellow-50 rounded-lg text-sm text-gray-700">
              📝 {customer.notes}
            </div>
          )}
        </div>
        <div className="card">
          <h3 className="font-semibold text-gray-700 mb-3">📊 Tổng quan</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Tổng đơn hàng</span><span className="font-bold">{customer.order_count}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Lần bảo hành</span><span className="font-bold text-orange-500">{customer.warranty_count}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Tổng chi tiêu</span>
              <span className="font-bold text-green-600">
                {fmtMoney(customer.orders?.reduce((s, o) => s + o.price * o.quantity, 0))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Đơn hàng */}
      <div className="card mb-4">
        <h3 className="font-semibold text-gray-700 mb-3">📦 Lịch sử đơn hàng</h3>
        {customer.orders?.length === 0 ? (
          <p className="text-gray-400 text-sm">Chưa có đơn hàng nào</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-gray-400 text-xs border-b">
              {['Sản phẩm', 'Mail account', 'Ngày mua', 'Hết hạn', 'Giá', 'Trạng thái', 'Thao tác'].map(h =>
                <th key={h} className="pb-2 text-left font-medium">{h}</th>
              )}
            </tr></thead>
            <tbody className="divide-y">
              {customer.orders?.map(o => {
                const days = daysLeft(o.expire_date);
                return (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="py-2 font-medium">{o.product_name}</td>
                    <td className="py-2 text-gray-500">{o.account_email || '—'}</td>
                    <td className="py-2">{fmtDate(o.purchase_date)}</td>
                    <td className="py-2">
                      <span className={expireStyle(o)}>
                        {fmtDate(o.expire_date)}
                        {o.status === 'active' && days !== null && days <= 7 && ` (còn ${days}d)`}
                      </span>
                    </td>
                    <td className="py-2 text-green-600 font-medium">{fmtMoney(o.price * o.quantity)}</td>
                    <td className="py-2">
                      <select value={o.status} onChange={e => updateOrderStatus(o.id, e.target.value)}
                        className="border rounded px-2 py-1 text-xs">
                        <option value="active">Active</option>
                        <option value="expired">Hết hạn</option>
                        <option value="renewed">Đã gia hạn</option>
                        <option value="cancelled">Hủy</option>
                      </select>
                    </td>
                    <td className="py-2">
                      <button onClick={() => { setWarrantyForm({...warrantyForm, order_id: o.id}); setWarrantyModal(true); }}
                        className="text-orange-400 hover:underline text-xs">Bảo hành</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Bảo hành */}
      <div className="card">
        <h3 className="font-semibold text-gray-700 mb-3">🔧 Lịch sử bảo hành</h3>
        {customer.warranties?.length === 0 ? (
          <p className="text-gray-400 text-sm">Chưa có lần bảo hành nào</p>
        ) : (
          <div className="space-y-3">
            {customer.warranties?.map(w => (
              <div key={w.id} className="border rounded-lg p-3 bg-orange-50">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>📅 {fmtDate(w.warranty_date)}</span>
                  {w.product_name && <span>{w.product_name}</span>}
                  {w.warranty_email && <span>Mail: {w.warranty_email}</span>}
                </div>
                <p className="text-sm font-medium text-gray-800">🔴 {w.issue}</p>
                {w.resolution && <p className="text-sm text-green-700 mt-1">✅ {w.resolution}</p>}
                {w.notes && <p className="text-xs text-gray-400 mt-1">{w.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal thêm đơn hàng */}
      {orderModal && (
        <Modal title="Thêm đơn hàng" onClose={() => setOrderModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="label">Sản phẩm *</label>
              <select className="input" value={orderForm.product_id} onChange={e => handleProductChange(e.target.value)}>
                <option value="">— Chọn sản phẩm —</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} — {new Intl.NumberFormat('vi-VN').format(p.price)}đ/{p.duration_months}th</option>)}
              </select>
            </div>
            <div>
              <label className="label">Mail account (tài khoản giao cho KH)</label>
              <input className="input" value={orderForm.account_email} onChange={e => setOrderForm({...orderForm, account_email: e.target.value})} placeholder="account@gmail.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Ngày mua *</label>
                <input type="date" className="input" value={orderForm.purchase_date}
                  onChange={e => {
                    const expire = autoExpire(orderForm.product_id, e.target.value);
                    setOrderForm({...orderForm, purchase_date: e.target.value, expire_date: expire});
                  }} />
              </div>
              <div>
                <label className="label">Ngày hết hạn *</label>
                <input type="date" className="input" value={orderForm.expire_date} onChange={e => setOrderForm({...orderForm, expire_date: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Giá (VNĐ) *</label>
                <input type="number" className="input" value={orderForm.price} onChange={e => setOrderForm({...orderForm, price: e.target.value})} placeholder="150000" />
              </div>
              <div>
                <label className="label">Số lượng</label>
                <input type="number" min={1} className="input" value={orderForm.quantity} onChange={e => setOrderForm({...orderForm, quantity: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="label">Ghi chú</label>
              <textarea className="input" rows={2} value={orderForm.notes} onChange={e => setOrderForm({...orderForm, notes: e.target.value})} />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setOrderModal(false)} className="btn-secondary">Hủy</button>
              <button onClick={saveOrder} className="btn-primary">💾 Lưu đơn hàng</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal bảo hành */}
      {warrantyModal && (
        <Modal title="Ghi bảo hành" onClose={() => setWarrantyModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="label">Đơn hàng liên quan</label>
              <select className="input" value={warrantyForm.order_id} onChange={e => setWarrantyForm({...warrantyForm, order_id: e.target.value})}>
                <option value="">— Chọn đơn (tùy chọn) —</option>
                {customer.orders?.map(o => <option key={o.id} value={o.id}>{o.product_name} — {fmtDate(o.purchase_date)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Mail bảo hành KH dùng</label>
              <input className="input" value={warrantyForm.warranty_email} onChange={e => setWarrantyForm({...warrantyForm, warranty_email: e.target.value})} placeholder="email KH báo lỗi" />
            </div>
            <div>
              <label className="label">Ngày bảo hành *</label>
              <input type="date" className="input" value={warrantyForm.warranty_date} onChange={e => setWarrantyForm({...warrantyForm, warranty_date: e.target.value})} />
            </div>
            <div>
              <label className="label">Mô tả vấn đề *</label>
              <textarea className="input" rows={2} value={warrantyForm.issue} onChange={e => setWarrantyForm({...warrantyForm, issue: e.target.value})} placeholder="KH báo lỗi gì?" />
            </div>
            <div>
              <label className="label">Cách xử lý</label>
              <textarea className="input" rows={2} value={warrantyForm.resolution} onChange={e => setWarrantyForm({...warrantyForm, resolution: e.target.value})} placeholder="Đã xử lý như thế nào?" />
            </div>
            <div>
              <label className="label">Ghi chú thêm</label>
              <input className="input" value={warrantyForm.notes} onChange={e => setWarrantyForm({...warrantyForm, notes: e.target.value})} />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setWarrantyModal(false)} className="btn-secondary">Hủy</button>
              <button onClick={saveWarranty} className="btn-primary">💾 Lưu bảo hành</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
