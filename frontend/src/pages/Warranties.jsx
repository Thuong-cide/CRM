import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';

const fmtDate = d => d ? new Date(d).toLocaleDateString('vi-VN') : '—';

function StatusBadge({ expireDate }) {
  if (!expireDate) return null;
  const days = Math.ceil((new Date(expireDate) - new Date()) / 86400000);
  if (days < 0) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">HẾT HẠN</span>;
  if (days <= 7) return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-400 text-white">còn {days}ng</span>;
  return null;
}

export default function Warranties() {
  const navigate = useNavigate();
  const [rows, setRows]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [search, setSearch]   = useState('');
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(false);
  const limit = 30;

  const fetchWarranties = useCallback(async (q = search, p = page) => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/warranties', { params: { search: q, page: p, limit } });
      setRows(data.data);
      setTotal(data.total);
    } catch { toast.error('Lỗi tải dữ liệu'); }
    finally { setLoading(false); }
  }, [search, page]);

  useEffect(() => { fetchWarranties(); }, [page]);

  const handleSearch = (val) => {
    setSearch(val);
    setPage(1);
    fetchWarranties(val, 1);
  };

  const deleteWarranty = async (id) => {
    if (!confirm('Xóa bảo hành này?')) return;
    await api.delete(`/api/warranties/${id}`);
    toast.success('Đã xóa');
    fetchWarranties();
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-3 md:p-6 max-w-6xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-800">🔧 Lịch sử bảo hành</h2>
          <p className="text-sm text-gray-400 mt-0.5">Tổng {total} lần bảo hành</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
        <input
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Tìm theo tên KH, email, mô tả lỗi, sản phẩm..."
          value={search}
          onChange={e => handleSearch(e.target.value)}
        />
        {loading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">...</span>}
      </div>

      {/* List */}
      {rows.length === 0 && !loading ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-2">🔧</div>
          <p>{search ? `Không tìm thấy kết quả cho "${search}"` : 'Chưa có lần bảo hành nào'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(w => (
            <div key={w.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-4">
              <div className="flex items-start justify-between gap-3">
                {/* Left: thông tin chính */}
                <div className="flex-1 min-w-0">
                  {/* Row 1: KH + ngày */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => navigate(`/customers/${w.customer_id}`)}
                      className="font-semibold text-blue-700 hover:underline text-sm"
                    >
                      {w.customer_name}
                    </button>
                    {w.customer_phone && (
                      <span className="text-xs text-gray-400">{w.customer_phone}</span>
                    )}
                    <span className="text-xs text-gray-300">•</span>
                    <span className="text-xs text-gray-400">📅 {fmtDate(w.warranty_date)}</span>
                  </div>

                  {/* Row 2: sản phẩm + email + hết hạn */}
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    {w.product_name && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        📦 {w.product_name}
                      </span>
                    )}
                    {w.warranty_email && (
                      <span className="text-xs text-blue-600">📧 {w.warranty_email}</span>
                    )}
                    <StatusBadge expireDate={w.order_expire} />
                  </div>

                  {/* Row 3: lỗi */}
                  <p className="text-sm text-red-600 font-medium mt-1.5">🔴 {w.issue}</p>

                  {/* Row 4: xử lý */}
                  {w.resolution && (
                    <p className="text-sm text-green-600 mt-0.5">✅ {w.resolution}</p>
                  )}
                  {w.notes && (
                    <p className="text-xs text-gray-400 mt-0.5">💬 {w.notes}</p>
                  )}
                </div>

                {/* Right: actions */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => navigate(`/customers/${w.customer_id}`)}
                    className="text-xs text-blue-500 hover:underline whitespace-nowrap"
                  >
                    👤 Xem KH
                  </button>
                  <button
                    onClick={() => navigate(`/customers/${w.customer_id}?warranty=1`)}
                    className="text-xs text-orange-500 hover:underline whitespace-nowrap"
                  >
                    🔧 BH mới
                  </button>
                  <button
                    onClick={() => deleteWarranty(w.id)}
                    className="text-xs text-red-400 hover:underline whitespace-nowrap"
                  >
                    🗑️ Xóa
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40 hover:bg-gray-50"
          >← Trước</button>
          <span className="text-sm text-gray-500">Trang {page}/{totalPages}</span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40 hover:bg-gray-50"
          >Sau →</button>
        </div>
      )}
    </div>
  );
}
