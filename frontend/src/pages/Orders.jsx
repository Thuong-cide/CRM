import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';

// Nút liên hệ nhanh
function ContactButtons({ r }) {
  const phone = r.customer_phone?.trim();
  const zalo  = r.customer_zalo?.trim();
  const fb    = r.customer_facebook?.trim();

  if (!phone && !zalo && !fb) return null;

  return (
    <div className="flex gap-1 mt-2 flex-wrap">
      {phone && (
        <a href={`tel:${phone}`}
          className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 transition">
          📞 Gọi
        </a>
      )}
      {zalo && (
        <a href={zalo.startsWith('http') ? zalo : `https://zalo.me/${zalo.replace(/^0/, '84')}`}
          target="_blank" rel="noreferrer"
          className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200 transition">
          💬 Zalo
        </a>
      )}
      {fb && (
        <a href={fb} target="_blank" rel="noreferrer"
          className="flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium hover:bg-indigo-200 transition">
          📘 FB
        </a>
      )}
    </div>
  );
}

export default function Orders() {
  const [rows, setRows]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [status, setStatus]   = useState('active');
  const [search, setSearch]   = useState('');
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(false);
  const LIMIT = 50;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/orders', {
        params: { status, search, page, limit: LIMIT },
      });
      setRows(data.data);
      setTotal(data.total);
    } catch { toast.error('Lỗi tải dữ liệu'); }
    finally { setLoading(false); }
  }, [status, search, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateStatus = async (id, newStatus) => {
    await api.put(`/api/orders/${id}`, { status: newStatus });
    toast.success('Đã cập nhật');
    fetchData();
  };

  const fmtDate  = d => d ? new Date(d).toLocaleDateString('vi-VN') : '—';
  const fmtMoney = v => v ? new Intl.NumberFormat('vi-VN').format(v) + 'đ' : '—';
  const daysLeft = d => d ? Math.ceil((new Date(d) - new Date()) / 86400000) : null;
  const totalPages = Math.ceil(total / LIMIT);

  const STATUS_TABS = [
    ['', 'Tất cả'],
    ['active', '✅ Active'],
    ['expired', '❌ Hết hạn'],
    ['renewed', '🔄 Gia hạn'],
    ['cancelled', '⛔ Hủy'],
  ];

  return (
    <div className="p-3 md:p-6">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg md:text-xl font-bold text-gray-800">
          📦 Đơn hàng <span className="text-gray-400 font-normal text-sm md:text-base">({total})</span>
        </h2>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 mb-4">
        <input
          className="input"
          placeholder="🔍 Tìm tên KH, SĐT, sản phẩm, mail account..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {STATUS_TABS.map(([v, l]) => (
            <button key={v}
              onClick={() => { setStatus(v); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium whitespace-nowrap transition ${
                status === v ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600'
              }`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* ── MOBILE: Card list ─────────────────────────────── */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="text-center py-10 text-gray-400">Đang tải...</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-10 text-gray-400">Không có đơn nào</div>
        ) : rows.map(r => {
          const days = daysLeft(r.expire_date);
          const isExpired  = r.status === 'expired' || (r.status === 'active' && days !== null && days <= 0);
          const isExpiring = r.status === 'active' && days !== null && days > 0 && days <= 7;
          const isUrgent   = isExpired || isExpiring;
          return (
            <div key={r.id}
              className={`bg-white rounded-xl border shadow-sm p-4 ${
                isExpired  ? 'border-red-300 bg-red-50' :
                isExpiring ? 'border-yellow-300 bg-yellow-50' :
                'border-gray-100'
              }`}>
              {/* Row 1: KH + trạng thái */}
              <div className="flex justify-between items-start mb-2">
                <div>
                  <Link to={`/customers/${r.customer_id}`}
                    className="font-semibold text-blue-600 text-sm">
                    {r.customer_name}
                  </Link>
                  {r.customer_phone && (
                    <div className="text-xs text-gray-400">{r.customer_phone}</div>
                  )}
                </div>
                <select
                  value={r.status}
                  onChange={e => updateStatus(r.id, e.target.value)}
                  className="border rounded-lg px-2 py-1 text-xs bg-white ml-2">
                  <option value="active">✅ Active</option>
                  <option value="expired">❌ Hết hạn</option>
                  <option value="renewed">🔄 Gia hạn</option>
                  <option value="cancelled">⛔ Hủy</option>
                </select>
              </div>

              {/* Row 2: SP + giá */}
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-800">{r.product_name}</span>
                <span className="text-sm font-semibold text-green-600">{fmtMoney(r.price * r.quantity)}</span>
              </div>

              {/* Row 3: account */}
              {r.account_email && (
                <div className="text-xs text-gray-400 mb-2">📧 {r.account_email}</div>
              )}

              {/* Row 4: ngày + còn lại */}
              <div className="flex justify-between items-center text-xs text-gray-500 border-t border-gray-100 pt-2 mt-2">
                <span>Hết hạn: {fmtDate(r.expire_date)}</span>
                {r.status === 'active' && days !== null && (
                  <span className={
                    days <= 0 ? 'badge-expired' :
                    days <= 7 ? 'badge-expiring' :
                    'text-gray-400'
                  }>
                    {days <= 0 ? 'Đã hết hạn' : `còn ${days} ngày`}
                  </span>
                )}
              </div>

              {/* Nút liên hệ nhanh — chỉ hiện khi urgent */}
              {isUrgent && (
                <div className="border-t border-gray-100 pt-2 mt-2">
                  <div className="text-xs text-gray-500 mb-1 font-medium">
                    {isExpired ? '❌ Hết hạn — Liên hệ gia hạn:' : '⚠️ Sắp hết hạn — Liên hệ:'}
                  </div>
                  <ContactButtons r={r} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── DESKTOP: Table ────────────────────────────────── */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-gray-500 text-xs uppercase">
            <tr>
              {['Khách hàng', 'Sản phẩm', 'Mail account', 'Ngày mua', 'Hết hạn', 'Còn lại', 'Giá', 'Trạng thái', 'Liên hệ'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={9} className="text-center py-10 text-gray-400">Đang tải...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-10 text-gray-400">Không có đơn nào</td></tr>
            ) : rows.map(r => {
              const days = daysLeft(r.expire_date);
              const isExpired  = r.status === 'expired' || (r.status === 'active' && days !== null && days <= 0);
              const isExpiring = r.status === 'active' && days !== null && days > 0 && days <= 7;
              const isUrgent   = isExpired || isExpiring;
              return (
                <tr key={r.id} className={`hover:bg-gray-50 ${
                  isExpired  ? 'bg-red-50' :
                  isExpiring ? 'bg-yellow-50' : ''
                }`}>
                  <td className="px-4 py-3">
                    <Link to={`/customers/${r.customer_id}`} className="font-medium text-blue-600 hover:underline">
                      {r.customer_name}
                    </Link>
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
                    <select value={r.status} onChange={e => updateStatus(r.id, e.target.value)}
                      className="border rounded px-2 py-1 text-xs">
                      <option value="active">Active</option>
                      <option value="expired">Hết hạn</option>
                      <option value="renewed">Gia hạn</option>
                      <option value="cancelled">Hủy</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {isUrgent
                      ? <ContactButtons r={r} />
                      : <span className="text-gray-300 text-xs">—</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-1 mt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={`px-3 py-1.5 rounded text-sm ${
                p === page ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600'
              }`}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
