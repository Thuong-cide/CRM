import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [customer, setCustomer] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orderModal, setOrderModal] = useState(false);
  const [warrantyModal, setWarrantyModal] = useState(false);
  const [editOrderModal, setEditOrderModal] = useState(false);   // Sửa đơn
  const [refundModal, setRefundModal] = useState(false);         // Refund
  const [editingOrder, setEditingOrder] = useState(null);        // Đơn đang sửa/refund
  const [orderForm, setOrderForm] = useState({ product_id: '', account_email: '', quantity: 1, price: '', cost_price: '', purchase_date: new Date().toISOString().split('T')[0], expire_date: '', notes: '', supplier: '' });
  const [editOrderForm, setEditOrderForm] = useState({});        // Form sửa đơn
  const [refundForm, setRefundForm] = useState({ refund_amount: '', refund_note: '' });
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

  // Tự mở modal bảo hành khi vào từ search (query: ?warranty=1&order_id=X&email=Y)
  useEffect(() => {
    if (!customer) return;
    const doWarranty = searchParams.get('warranty');
    if (doWarranty === '1') {
      const orderId = searchParams.get('order_id') || '';
      const email   = searchParams.get('email') || '';
      setWarrantyForm(f => ({
        ...f,
        order_id: orderId,
        warranty_email: email,
      }));
      setWarrantyModal(true);
      // Xóa query params khỏi URL để không mở lại khi refresh
      setSearchParams({}, { replace: true });
    }
  }, [customer, searchParams]);

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
    setOrderForm({
      ...orderForm,
      product_id:  pid,
      price:       p ? p.price               : '',
      cost_price:  p ? (p.cost_price ?? '')  : '',
      expire_date: expire,
    });
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

  // Lấy supplier từ order được chọn
  const getSupplierOfOrder = (orderId) => {
    if (!orderId) return null;
    const o = customer?.orders?.find(x => String(x.id) === String(orderId));
    return o?.supplier || null;
  };

  // Lấy toàn bộ thông tin order
  const getOrderById = (orderId) => {
    if (!orderId) return null;
    return customer?.orders?.find(x => String(x.id) === String(orderId)) || null;
  };

  // Lấy tất cả email đã từng dùng của KH (từ đơn hàng + lịch sử bảo hành)
  const getAllKnownEmails = (selectedOrderId) => {
    const emails = new Set();
    customer?.orders?.forEach(o => {
      if (o.account_email) emails.add(o.account_email);
    });
    customer?.warranties?.forEach(w => {
      if (w.warranty_email) emails.add(w.warranty_email);
    });
    return [...emails];
  };

  // Đếm số lần email đã được dùng để báo lỗi bảo hành
  const getEmailWarrantyCount = (email) => {
    if (!email) return 0;
    return (customer?.warranties || []).filter(
      w => w.warranty_email?.toLowerCase().trim() === email.toLowerCase().trim()
    ).length;
  };

  // Lấy danh sách các lần bảo hành đã dùng email này
  const getEmailWarrantyHistory = (email) => {
    if (!email) return [];
    return (customer?.warranties || []).filter(
      w => w.warranty_email?.toLowerCase().trim() === email.toLowerCase().trim()
    );
  };

  // Tìm tất cả đơn hàng liên quan đến email này
  // (account_email trùng HOẶC đã từng bảo hành bằng email này)
  const getOrdersRelatedToEmail = (email) => {
    if (!email) return [];
    const e = email.toLowerCase().trim();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Tập order_id đã từng dùng email này để bảo hành
    const warrantyOrderIds = new Set(
      (customer?.warranties || [])
        .filter(w => w.warranty_email?.toLowerCase().trim() === e && w.order_id)
        .map(w => w.order_id)
    );

    return (customer?.orders || []).filter(o => {
      const matchEmail = o.account_email?.toLowerCase().trim() === e;
      const matchWarranty = warrantyOrderIds.has(o.id);
      return matchEmail || matchWarranty;
    }).map(o => {
      const expireDate = new Date(o.expire_date);
      expireDate.setHours(0, 0, 0, 0);
      return { ...o, isExpired: expireDate < today };
    });
  };

  const EMPTY_WARRANTY = { order_id: '', warranty_email: '', issue: '', resolution: '', warranty_date: new Date().toISOString().split('T')[0], notes: '' };

  const saveWarranty = async () => {
    const { issue, warranty_date } = warrantyForm;
    if (!issue || !warranty_date) return toast.error('Điền mô tả vấn đề và ngày bảo hành');
    try {
      await api.post('/api/warranties', { ...warrantyForm, customer_id: id });
      toast.success('Đã ghi bảo hành');
      setWarrantyModal(false);
      setWarrantyForm(EMPTY_WARRANTY);
      fetchCustomer();
    } catch (err) { toast.error(err.response?.data?.error || 'Lỗi'); }
  };

  // Mở modal bảo hành với đơn chọn sẵn + email auto-fill
  const openWarrantyModal = (order = null) => {
    setWarrantyForm({
      ...EMPTY_WARRANTY,
      order_id: order ? String(order.id) : '',
      warranty_email: order?.account_email || '',
    });
    setWarrantyModal(true);
  };

  // Đóng modal + reset
  const closeWarrantyModal = () => {
    setWarrantyModal(false);
    setWarrantyForm(EMPTY_WARRANTY);
  };

  const updateOrderStatus = async (orderId, status) => {
    await api.put(`/api/orders/${orderId}`, { status });
    toast.success('Đã cập nhật'); fetchCustomer();
  };

  // Mở modal sửa đơn
  const openEditOrder = (o) => {
    setEditingOrder(o);
    setEditOrderForm({
      product_id:    o.product_id,
      account_email: o.account_email || '',
      quantity:      o.quantity,
      price:         o.price,
      cost_price:    o.cost_price ?? '',
      purchase_date: o.purchase_date,
      expire_date:   o.expire_date,
      status:        o.status,
      supplier:      o.supplier || '',
      notes:         o.notes || '',
    });
    setEditOrderModal(true);
  };

  const saveEditOrder = async () => {
    if (!editOrderForm.price || !editOrderForm.purchase_date || !editOrderForm.expire_date)
      return toast.error('Thiếu giá, ngày mua hoặc ngày hết hạn');
    try {
      await api.put(`/api/orders/${editingOrder.id}`, editOrderForm);
      toast.success('Đã cập nhật đơn hàng');
      setEditOrderModal(false); fetchCustomer();
    } catch (err) { toast.error(err.response?.data?.error || 'Lỗi'); }
  };

  // Mở modal refund
  const openRefund = (o) => {
    setEditingOrder(o);
    setRefundForm({
      refund_amount: o.refund_amount ?? '',
      refund_note:   o.refund_note  ?? '',
    });
    setRefundModal(true);
  };

  const saveRefund = async () => {
    if (!refundForm.refund_amount) return toast.error('Nhập số tiền refund');
    try {
      await api.put(`/api/orders/${editingOrder.id}`, {
        refund_amount: parseFloat(refundForm.refund_amount),
        refund_note:   refundForm.refund_note || null,
        status:        'cancelled',
      });
      toast.success('Đã ghi nhận refund');
      setRefundModal(false); fetchCustomer();
    } catch (err) { toast.error(err.response?.data?.error || 'Lỗi'); }
  };

  // Xóa đơn
  const deleteOrder = async (o) => {
    if (!confirm(`Xóa đơn hàng "${o.product_name}" của ${customer.name}?\nThao tác này không thể hoàn tác!`))
      return;
    try {
      await api.delete(`/api/orders/${o.id}`);
      toast.success('Đã xóa đơn hàng'); fetchCustomer();
    } catch (err) { toast.error(err.response?.data?.error || 'Lỗi'); }
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
    <div className="p-3 md:p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
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
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => openWarrantyModal()} className="btn-secondary">🔧 Ghi bảo hành</button>
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
          <>
            {/* MOBILE: cards */}
            <div className="md:hidden space-y-3">
              {customer.orders?.map(o => {
                const days = daysLeft(o.expire_date);
                return (
                  <div key={o.id} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-gray-800 text-sm">{o.product_name}</span>
                      <select value={o.status} onChange={e => updateOrderStatus(o.id, e.target.value)}
                        className="border rounded-lg px-2 py-1 text-xs bg-white ml-2">
                        <option value="active">✅ Active</option>
                        <option value="expired">❌ Hết hạn</option>
                        <option value="renewed">🔄 Gia hạn</option>
                        <option value="cancelled">⛔ Hủy</option>
                      </select>
                    </div>
                    {o.account_email && <div className="text-xs text-gray-500 mb-1">📧 {o.account_email}</div>}
                    {o.supplier && <div className="mb-1"><span className="inline-block px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 text-xs font-medium">🏭 {o.supplier}</span></div>}
                    <div className="flex justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
                      <span className={expireStyle(o)}>
                        HH: {fmtDate(o.expire_date)}
                        {o.status === 'active' && days !== null && days <= 7 && ` (còn ${days}d)`}
                      </span>
                      <div className="flex gap-2 items-center">
                        <span className="text-green-600 font-medium">{fmtMoney(o.price * o.quantity)}</span>
                        {o.cost_price != null && (
                          <span className={(o.price - o.cost_price) >= 0 ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
                            {(o.price - o.cost_price) >= 0 ? '+' : ''}{fmtMoney((o.price - o.cost_price) * o.quantity)}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Actions mobile */}
                    <div className="flex gap-3 mt-2 pt-2 border-t border-gray-200">
                      <button onClick={() => openWarrantyModal(o)}
                        className="flex-1 py-1.5 rounded-lg bg-orange-50 text-orange-600 text-xs font-medium text-center active:bg-orange-100">🔧 BH</button>
                      <button onClick={() => openEditOrder(o)}
                        className="flex-1 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium text-center active:bg-blue-100">✏️ Sửa</button>
                      <button onClick={() => openRefund(o)}
                        className="flex-1 py-1.5 rounded-lg bg-purple-50 text-purple-600 text-xs font-medium text-center active:bg-purple-100">💸 Refund</button>
                      <button onClick={() => deleteOrder(o)}
                        className="flex-1 py-1.5 rounded-lg bg-red-50 text-red-500 text-xs font-medium text-center active:bg-red-100">🗑️ Xóa</button>
                    </div>
                    {/* Hiện refund nếu có */}
                    {o.refund_amount != null && (
                      <div className="mt-1 text-xs text-purple-600 font-medium">
                        💸 Refund: {fmtMoney(o.refund_amount)}{o.refund_note ? ` — ${o.refund_note}` : ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* DESKTOP: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-gray-400 text-xs border-b">
                  {['Sản phẩm', 'Mail / Nguồn', 'Ngày mua', 'Hết hạn', 'Giá bán', 'Lợi nhuận', 'Trạng thái', 'Thao tác'].map(h =>
                    <th key={h} className="pb-2 text-left font-medium">{h}</th>
                  )}
                </tr></thead>
                <tbody className="divide-y">
                  {customer.orders?.map(o => {
                    const days = daysLeft(o.expire_date);
                    return (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="py-2 font-medium">{o.product_name}</td>
                        <td className="py-2 text-gray-500">
                          <div>{o.account_email || '—'}</div>
                          {o.supplier && (
                            <div className="text-xs mt-0.5">
                              <span className="inline-block px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium">🏭 {o.supplier}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-2">{fmtDate(o.purchase_date)}</td>
                        <td className="py-2">
                          <span className={expireStyle(o)}>
                            {fmtDate(o.expire_date)}
                            {o.status === 'active' && days !== null && days <= 7 && ` (còn ${days}d)`}
                          </span>
                        </td>
                        <td className="py-2 text-green-600 font-medium">{fmtMoney(o.price * o.quantity)}</td>
                        <td className="py-2">
                          {o.cost_price != null ? (
                            <span className={(o.price - o.cost_price) >= 0 ? 'text-emerald-600 font-medium text-xs' : 'text-red-500 font-medium text-xs'}>
                              {(o.price - o.cost_price) >= 0 ? '+' : ''}{fmtMoney((o.price - o.cost_price) * o.quantity)}
                            </span>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
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
                          <div className="flex flex-col gap-1">
                            <div className="flex gap-2 flex-wrap">
                              <button onClick={() => openWarrantyModal(o)}
                                className="text-orange-400 hover:underline text-xs">🔧 BH</button>
                              <button onClick={() => openEditOrder(o)}
                                className="text-blue-500 hover:underline text-xs">✏️ Sửa</button>
                              <button onClick={() => openRefund(o)}
                                className="text-purple-500 hover:underline text-xs">💸 Refund</button>
                              <button onClick={() => deleteOrder(o)}
                                className="text-red-400 hover:underline text-xs">🗑️ Xóa</button>
                            </div>
                            {o.refund_amount != null && (
                              <span className="text-xs text-purple-600">💸 {fmtMoney(o.refund_amount)}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

            {/* Bảo hành */}
      <div className="card">
        <h3 className="font-semibold text-gray-700 mb-3">🔧 Lịch sử bảo hành</h3>
        {customer.warranties?.length === 0 ? (
          <p className="text-gray-400 text-sm">Chưa có lần bảo hành nào</p>
        ) : (
          <div className="space-y-3">
            {customer.warranties?.map(w => {
              const linkedOrder = getOrderById(w.order_id);
              return (
                <div key={w.id} className="border border-orange-200 rounded-xl p-3 bg-orange-50">

                  {/* Header: ngày + đơn liên quan */}
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-gray-500">📅 {fmtDate(w.warranty_date)}</span>
                    {linkedOrder ? (
                      <span className="text-xs bg-white border border-orange-200 rounded-lg px-2 py-0.5 text-orange-700 font-medium">
                        #{linkedOrder.id}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Không gắn đơn</span>
                    )}
                  </div>

                  {/* Thông tin đơn hàng liên quan — hiển thị rõ ràng */}
                  {linkedOrder && (
                    <div className="mb-2 p-2 bg-white rounded-lg border border-orange-100 text-xs space-y-0.5">
                      <div className="flex justify-between">
                        <span className="font-semibold text-gray-700">📦 {linkedOrder.product_name}</span>
                        <span className="text-gray-500">{fmtDate(linkedOrder.purchase_date)} → {fmtDate(linkedOrder.expire_date)}</span>
                      </div>
                      {linkedOrder.account_email && (
                        <div className="text-gray-500">📧 {linkedOrder.account_email}</div>
                      )}
                      {linkedOrder.supplier && (
                        <div>
                          <span className="inline-block px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium">
                            🏭 Nguồn: {linkedOrder.supplier}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Vấn đề */}
                  <p className="text-sm font-medium text-red-700">🔴 {w.issue}</p>

                  {/* Mail KH dùng */}
                  {w.warranty_email && (
                    <p className="text-xs text-gray-500 mt-1">📧 Mail tại thời điểm BH: <span className="font-medium text-gray-700">{w.warranty_email}</span></p>
                  )}


                  {/* Cách xử lý */}
                  {w.resolution && (
                    <p className="text-sm text-green-700 mt-1">✅ {w.resolution}</p>
                  )}

                  {w.notes && (
                    <p className="text-xs text-gray-400 mt-1">💬 {w.notes}</p>
                  )}
                </div>
              );
            })}
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
            <div>
              <label className="label">Nguồn cung (nhà cung cấp) *</label>
              <input className="input" value={orderForm.supplier}
                onChange={e => setOrderForm({...orderForm, supplier: e.target.value})}
                placeholder="VD: Nguồn A, Nguồn B, Agency X..." />
              <p className="text-xs text-gray-400 mt-1">Dùng để tra cứu khi cần bảo hành với nhà cung cấp</p>
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
                <label className="label">Giá bán (VNĐ) *</label>
                <input type="number" className="input" value={orderForm.price} onChange={e => setOrderForm({...orderForm, price: e.target.value})} placeholder="150000" />
              </div>
              <div>
                <label className="label">Giá nhập (VNĐ)</label>
                <input type="number" className="input" value={orderForm.cost_price} onChange={e => setOrderForm({...orderForm, cost_price: e.target.value})} placeholder="100000" />
                {orderForm.price && orderForm.cost_price && (
                  <p className="text-xs mt-1 font-medium text-emerald-600">
                    Lợi nhuận: {fmtMoney((parseFloat(orderForm.price) - parseFloat(orderForm.cost_price)) * (parseInt(orderForm.quantity) || 1))}
                  </p>
                )}
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
        <Modal title="🔧 Ghi bảo hành" onClose={closeWarrantyModal}>
          <div className="space-y-3">

            {/* Chọn đơn hàng — bắt buộc khi KH có nhiều đơn */}
            <div>
              <label className="label">Đơn hàng liên quan {customer.orders?.length > 1 ? '*' : ''}</label>
              <select className="input" value={warrantyForm.order_id}
                onChange={e => {
                  const oid = e.target.value;
                  const o = customer.orders?.find(x => String(x.id) === oid);
                  setWarrantyForm({
                    ...warrantyForm,
                    order_id: oid,
                    // Auto-fill mail từ account của đơn nếu chưa điền
                    warranty_email: warrantyForm.warranty_email || (o?.account_email ?? ''),
                  });
                }}>
                <option value="">— Chọn đơn hàng —</option>
                {customer.orders?.map(o => (
                  <option key={o.id} value={o.id}>
                    #{o.id} • {o.product_name}
                    {o.account_email ? ` • ${o.account_email}` : ''}
                    {' • '}{fmtDate(o.purchase_date)}–{fmtDate(o.expire_date)}
                  </option>
                ))}
              </select>

              {/* Preview đơn đã chọn */}
              {warrantyForm.order_id && (() => {
                const o = getOrderById(warrantyForm.order_id);
                if (!o) return null;
                return (
                  <div className="mt-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="font-semibold text-blue-800">📦 {o.product_name}</span>
                      <span className="text-blue-600">{fmtDate(o.purchase_date)} → {fmtDate(o.expire_date)}</span>
                    </div>
                    {o.account_email && <div className="text-blue-700">📧 {o.account_email}</div>}
                    {o.supplier && (
                      <div>
                        <span className="inline-block px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-medium">
                          🏭 {o.supplier}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div>
              <label className="label">Mail KH đang dùng tại thời điểm bảo hành
                <span className="ml-1 text-gray-400 font-normal text-xs">(email1 gốc, email2 sau đổi, email3...)</span>
              </label>
              {(() => {
                const knownEmails = getAllKnownEmails(warrantyForm.order_id);
                const warnCount = getEmailWarrantyCount(warrantyForm.warranty_email);
                const warnHistory = getEmailWarrantyHistory(warrantyForm.warranty_email);
                const relatedOrders = getOrdersRelatedToEmail(warrantyForm.warranty_email);
                const expiredOrders = relatedOrders.filter(o => o.isExpired);
                const hasExpiredWarning = expiredOrders.length > 0;
                const inputBorderClass = hasExpiredWarning
                  ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                  : warnCount > 0
                  ? 'border-orange-400 focus:border-orange-500 focus:ring-orange-200'
                  : '';
                return (
                  <>
                    <input
                      className={`input ${inputBorderClass}`}
                      list="known-emails-list"
                      value={warrantyForm.warranty_email}
                      onChange={e => setWarrantyForm({...warrantyForm, warranty_email: e.target.value})}
                      placeholder="VD: email2 sau khi đổi từ email1"
                    />
                    {knownEmails.length > 0 && (
                      <datalist id="known-emails-list">
                        {knownEmails.map(email => (
                          <option key={email} value={email} />
                        ))}
                      </datalist>
                    )}

                    {/* Cảnh báo email đã bảo hành trước */}
                    {warnCount > 0 && (
                      <div className="mt-2 p-2.5 bg-orange-50 border border-orange-300 rounded-lg">
                        <div className="flex items-start gap-2">
                          <span className="text-orange-500 text-base mt-0.5">⚠️</span>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-orange-700">
                              Email này đã bảo hành <span className="underline">{warnCount} lần</span> trướcđó!
                            </p>
                            <div className="mt-1 space-y-0.5">
                              {warnHistory.map((w, i) => (
                                <div key={w.id} className="text-xs text-orange-600">
                                  #{i + 1} • {w.warranty_date} — {w.issue?.slice(0, 60)}{w.issue?.length > 60 ? '...' : ''}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Cảnh báo đơn hàng hết hạn */}
                    {hasExpiredWarning && (
                      <div className="mt-2 p-2.5 bg-red-50 border border-red-400 rounded-lg">
                        <div className="flex items-start gap-2">
                          <span className="text-red-500 text-base mt-0.5">🚨</span>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-red-700">
                              Email này thuộc đơn hàng đã hết hạn!
                            </p>
                            <div className="mt-1 space-y-1">
                              {expiredOrders.map(o => (
                                <div key={o.id} className="text-xs text-red-600 bg-red-100 rounded px-2 py-1">
                                  <span className="font-medium">📦 #{o.id} {o.product_name}</span>
                                  <span className="ml-2">• HH: {fmtDate(o.expire_date)}</span>
                                  {o.account_email?.toLowerCase().trim() === warrantyForm.warranty_email?.toLowerCase().trim()
                                    ? <span className="ml-1 text-red-500">(email chính của đơn)</span>
                                    : <span className="ml-1 text-red-400">(email từng bảo hành cho đơn này)</span>
                                  }
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-red-500 mt-1.5 font-medium">⚠️ Kiểm tra lại xem KH có đơn hàng còn hiệu lực không!</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {knownEmails.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <span className="text-xs text-gray-400">Email đã dùng:</span>
                        {knownEmails.map(email => {
                          const count = getEmailWarrantyCount(email);
                          return (
                            <button
                              key={email}
                              type="button"
                              onClick={() => setWarrantyForm({...warrantyForm, warranty_email: email})}
                              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                                warrantyForm.warranty_email === email
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50'
                              }`}
                            >
                              {email}
                              {count > 0 && (
                                <span className={`ml-1 px-1 rounded-full text-[10px] font-bold ${
                                  warrantyForm.warranty_email === email
                                    ? 'bg-white text-blue-600'
                                    : 'bg-orange-100 text-orange-600'
                                }`}>{count}x</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            <div>
              <label className="label">Ngày bảo hành *</label>
              <input type="date" className="input" value={warrantyForm.warranty_date}
                onChange={e => setWarrantyForm({...warrantyForm, warranty_date: e.target.value})} />
            </div>
            <div>
              <label className="label">Mô tả vấn đề *</label>
              <textarea className="input" rows={2} value={warrantyForm.issue}
                onChange={e => setWarrantyForm({...warrantyForm, issue: e.target.value})}
                placeholder="KH báo lỗi gì?" />
            </div>
            <div>
              <label className="label">Cách xử lý</label>
              <textarea className="input" rows={2} value={warrantyForm.resolution}
                onChange={e => setWarrantyForm({...warrantyForm, resolution: e.target.value})}
                placeholder="Đã xử lý như thế nào?" />
            </div>
            <div>
              <label className="label">Ghi chú thêm</label>
              <input className="input" value={warrantyForm.notes}
                onChange={e => setWarrantyForm({...warrantyForm, notes: e.target.value})} />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={closeWarrantyModal} className="btn-secondary">Hủy</button>
              <button onClick={saveWarranty} className="btn-primary">💾 Lưu bảo hành</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal Sửa đơn hàng ── */}
      {editOrderModal && editingOrder && (
        <Modal title="✏️ Sửa đơn hàng" onClose={() => setEditOrderModal(false)} size="lg">
          <div className="space-y-3">
            <div className="p-2 bg-gray-50 rounded-lg text-xs text-gray-500">
              #{editingOrder.id} • {editingOrder.product_name} • KH: {customer.name}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Mail account</label>
                <input className="input" value={editOrderForm.account_email}
                  onChange={e => setEditOrderForm({...editOrderForm, account_email: e.target.value})}
                  placeholder="account@gmail.com" />
              </div>
              <div>
                <label className="label">Nguồn cung</label>
                <input className="input" value={editOrderForm.supplier}
                  onChange={e => setEditOrderForm({...editOrderForm, supplier: e.target.value})}
                  placeholder="Nguồn A..." />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Giá bán (VNĐ) *</label>
                <input type="number" className="input" value={editOrderForm.price}
                  onChange={e => setEditOrderForm({...editOrderForm, price: e.target.value})} />
              </div>
              <div>
                <label className="label">Giá nhập (VNĐ)</label>
                <input type="number" className="input" value={editOrderForm.cost_price}
                  onChange={e => setEditOrderForm({...editOrderForm, cost_price: e.target.value})} />
                {editOrderForm.price && editOrderForm.cost_price && (
                  <p className="text-xs mt-1 text-emerald-600 font-medium">
                    Lợi nhuận: {fmtMoney((parseFloat(editOrderForm.price)||0) - (parseFloat(editOrderForm.cost_price)||0))}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Ngày mua *</label>
                <input type="date" className="input" value={editOrderForm.purchase_date}
                  onChange={e => setEditOrderForm({...editOrderForm, purchase_date: e.target.value})} />
              </div>
              <div>
                <label className="label">Ngày hết hạn *</label>
                <input type="date" className="input" value={editOrderForm.expire_date}
                  onChange={e => setEditOrderForm({...editOrderForm, expire_date: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Số lượng</label>
                <input type="number" min={1} className="input" value={editOrderForm.quantity}
                  onChange={e => setEditOrderForm({...editOrderForm, quantity: e.target.value})} />
              </div>
              <div>
                <label className="label">Trạng thái</label>
                <select className="input" value={editOrderForm.status}
                  onChange={e => setEditOrderForm({...editOrderForm, status: e.target.value})}>
                  <option value="active">✅ Active</option>
                  <option value="expired">❌ Hết hạn</option>
                  <option value="renewed">🔄 Gia hạn</option>
                  <option value="cancelled">⛔ Hủy</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">Ghi chú</label>
              <input className="input" value={editOrderForm.notes}
                onChange={e => setEditOrderForm({...editOrderForm, notes: e.target.value})} />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => setEditOrderModal(false)} className="btn-secondary">Hủy</button>
              <button onClick={saveEditOrder} className="btn-primary">💾 Lưu thay đổi</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal Refund ── */}
      {refundModal && editingOrder && (() => {
        const totalPrice   = editingOrder.price * editingOrder.quantity;
        const start        = new Date(editingOrder.purchase_date);
        const end          = new Date(editingOrder.expire_date);
        const today        = new Date();
        const totalDays    = Math.max(Math.ceil((end - start) / 86400000), 1);
        const usedDays     = Math.max(Math.min(Math.ceil((today - start) / 86400000), totalDays), 0);
        const remainDays   = totalDays - usedDays;
        const pricePerDay  = totalPrice / totalDays;
        const refundByDays = Math.round(pricePerDay * remainDays);
        const pctUsed      = Math.round((usedDays / totalDays) * 100);

        const setByDays = () => setRefundForm({ ...refundForm, refund_amount: String(refundByDays) });
        const setHalf   = () => setRefundForm({ ...refundForm, refund_amount: String(Math.round(totalPrice / 2)) });
        const setFull   = () => setRefundForm({ ...refundForm, refund_amount: String(totalPrice) });

        return (
          <Modal title="💸 Ghi nhận Refund" onClose={() => setRefundModal(false)}>
            <div className="space-y-4">

              {/* Thông tin đơn */}
              <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="font-semibold text-gray-800">{editingOrder.product_name}</span>
                  <span className="text-green-600 font-bold">{fmtMoney(totalPrice)}</span>
                </div>
                {editingOrder.account_email && (
                  <div className="text-xs text-gray-500">📧 {editingOrder.account_email}</div>
                )}
                <div className="text-xs text-gray-400">
                  {fmtDate(editingOrder.purchase_date)} → {fmtDate(editingOrder.expire_date)}
                </div>
              </div>

              {/* Thống kê sử dụng */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                <p className="text-xs font-semibold text-blue-700 mb-1">📅 Thống kê sử dụng</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white rounded-lg p-2">
                    <p className="text-lg font-bold text-gray-800">{totalDays}</p>
                    <p className="text-xs text-gray-400">Tổng ngày</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-2">
                    <p className="text-lg font-bold text-orange-600">{usedDays}</p>
                    <p className="text-xs text-gray-400">Đã dùng</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2">
                    <p className="text-lg font-bold text-green-600">{remainDays}</p>
                    <p className="text-xs text-gray-400">Còn lại</p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-400 rounded-full transition-all"
                    style={{ width: `${pctUsed}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Giá/ngày: {fmtMoney(Math.round(pricePerDay))}</span>
                  <span>Đã dùng {pctUsed}%</span>
                </div>
              </div>

              {/* Số tiền refund */}
              <div>
                <label className="label">Số tiền refund (VNĐ) *</label>
                <input type="number" className="input" placeholder="Nhập hoặc chọn gợi ý bên dưới"
                  value={refundForm.refund_amount}
                  onChange={e => setRefundForm({...refundForm, refund_amount: e.target.value})} />

                {/* Gợi ý nhanh */}
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <button onClick={setByDays}
                    className="text-xs px-2 py-2 rounded-lg bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 font-medium text-center">
                    <p>📅 Theo ngày</p>
                    <p className="font-bold">{fmtMoney(refundByDays)}</p>
                    <p className="text-gray-400">{remainDays} ngày còn</p>
                  </button>
                  <button onClick={setHalf}
                    className="text-xs px-2 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-medium text-center">
                    <p>½ Giá</p>
                    <p className="font-bold">{fmtMoney(Math.round(totalPrice / 2))}</p>
                    <p className="text-gray-400">50%</p>
                  </button>
                  <button onClick={setFull}
                    className="text-xs px-2 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-medium text-center">
                    <p>Toàn bộ</p>
                    <p className="font-bold">{fmtMoney(totalPrice)}</p>
                    <p className="text-gray-400">100%</p>
                  </button>
                </div>

                {/* Preview */}
                {refundForm.refund_amount && (
                  <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700">
                    💸 Refund <strong>{fmtMoney(parseFloat(refundForm.refund_amount)||0)}</strong>
                    {' / '}{fmtMoney(totalPrice)}
                    {' — '}
                    <span className="font-medium">
                      {Math.round(((parseFloat(refundForm.refund_amount)||0) / totalPrice) * 100)}% giá trị đơn
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="label">Lý do refund</label>
                <input className="input" placeholder="VD: khách không hài lòng, lỗi sản phẩm..."
                  value={refundForm.refund_note}
                  onChange={e => setRefundForm({...refundForm, refund_note: e.target.value})} />
              </div>

              <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
                ⚠️ Đơn hàng sẽ chuyển sang <strong>Hủy</strong> sau khi xác nhận refund
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button onClick={() => setRefundModal(false)} className="btn-secondary">Hủy</button>
                <button onClick={saveRefund}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition">
                  💸 Xác nhận Refund
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
