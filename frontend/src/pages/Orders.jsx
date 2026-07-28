import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function Orders() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('active');
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/orders', { params: { status } });
      setRows(data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [status]);

  const updateStatus = async (id, newStatus) => {
    await api.put(`/api/orders/${id}`, { status: newStatus });
    toast.success('Đã cập nhật'); fetchData();
  };

  const fmtDate = d => d ? new Date(d).toLocaleDateString('vi-VN') : '—';
  const fmtMoney = v => v ? new Intl.NumberFormat('vi-VN').format(v) + 'đ' : '—';
  const daysLeft = d => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">📦 Đơn hàng</h2>
      </div>
      <div className="flex gap-2 mb-4">
        {[['', 'Tất cả'], ['active', '✅ Active'], ['expired', '❌ Hết hạn'], ['renewed', '🔄 Gia hạn'], ['cancelled', '⛔ Hủy']].map(([v, l]) => (
          <button key={v} onClick={() => setStatus(v)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${status === v ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>{l}</button>
        ))}
      </div>
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-gray-500 text-xs uppercase">
            <tr>{['Khách hàng', 'Sản phẩm', 'Mail account', 'Ngày mua', 'Hết hạn', 'Còn lại', 'Giá', 'Trạng thái'].map(h =>
              <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? <tr><td colSpan={8} className="text-center py-10 text-gray-400">Đang tải...</td></tr>
              : rows.length === 0 ? <tr><td colSpan={8} className="text-center py-10 text-gray-400">Không có đơn nào</td></tr>
              : rows.map(r => {
                const days = daysLeft(r.expire_date);
                const isUrgent = r.status === 'active' && days !== null && days <= 7;
                return (
                  <tr key={r.id} className={`hover:bg-gray-50 ${isUrgent ? 'bg-yellow-50' : ''}`}>
                    <td className="px-4 py-3">
                      <Link to={`/customers/${r.customer_id}`} className="font-medium text-blue-600 hover:underline">{r.customer_name}</Link>
                      {r.customer_phone && <div className="text-xs text-gray-400">{r.customer_phone}</div>}
                    </td>
                    <td className="px-4 py-3 font-medium">{r.product_name}</td>
                    <td className="px-4 py-3 text-gray-500">{r.account_email || '—'}</td>
                    <td className="px-4 py-3">{fmtDate(r.purchase_date)}</td>
                    <td className="px-4 py-3">{fmtDate(r.expire_date)}</td>
                    <td className="px-4 py-3">
                      {r.status === 'active' && days !== null ? (
                        <span className={days <= 0 ? 'badge-expired' : days <= 7 ? 'badge-expiring' : 'text-gray-500 text-xs'}>
                          {days <= 0 ? 'Hết hạn' : `${days} ngày`}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-green-600">{fmtMoney(r.price * r.quantity)}</td>
                    <td className="px-4 py-3">
                      <select value={r.status} onChange={e => updateStatus(r.id, e.target.value)} className="border rounded px-2 py-1 text-xs">
                        <option value="active">Active</option>
                        <option value="expired">Hết hạn</option>
                        <option value="renewed">Gia hạn</option>
                        <option value="cancelled">Hủy</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
