import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';

const EMPTY_FORM = { name: '', phone: '', email: '', zalo: '', facebook: '', type: 'lead', source: '', interest: '', notes: '' };

function QuickContact({ phone, zalo, facebook }) {
  if (!phone && !zalo && !facebook) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
      {phone && (
        <a
          href={`tel:${phone}`}
          onClick={e => e.stopPropagation()}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-50 hover:bg-green-100 text-green-700 text-xs font-medium transition-colors"
        >
          📞 Gọi
        </a>
      )}
      {(zalo || phone) && (
        <a
          href={`https://zalo.me/${(zalo || phone).replace(/^0/, '84')}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium transition-colors"
        >
          💬 Zalo
        </a>
      )}
      {facebook && (
        <a
          href={facebook.startsWith('http') ? facebook : `https://${facebook}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium transition-colors"
        >
          📘 FB
        </a>
      )}
    </div>
  );
}

function TypeBadge({ type }) {
  return type === 'buyer'
    ? <span className="badge-buyer text-xs">✅ Đã mua</span>
    : <span className="badge-lead text-xs">🎯 Tiềm năng</span>;
}

function CustomerCard({ r, onEdit, onDelete, navigate }) {
  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer p-4 flex flex-col"
      onClick={() => navigate(`/customers/${r.id}`)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{r.name}</p>
          {r.phone && <p className="text-sm text-gray-500 mt-0.5">{r.phone}</p>}
        </div>
        <TypeBadge type={r.type} />
      </div>

      {/* Info */}
      <div className="mt-2 space-y-0.5 text-xs text-gray-400">
        {r.email && <p>✉️ {r.email}</p>}
        {r.interest && <p>🎯 {r.interest}</p>}
        <div className="flex gap-3 mt-1">
          {r.order_count > 0 && <span>🛒 {r.order_count} đơn</span>}
          {r.warranty_count > 0 && <span>🔧 {r.warranty_count} BH</span>}
          {r.first_purchase && <span>📅 {new Date(r.first_purchase).toLocaleDateString('vi-VN')}</span>}
        </div>
      </div>

      {/* Nút liên hệ */}
      <QuickContact phone={r.phone} zalo={r.zalo} facebook={r.facebook} />

      {/* Actions */}
      <div className="flex items-center justify-between mt-3 pt-2">
        <button
          onClick={e => { e.stopPropagation(); navigate(`/customers/${r.id}`); }}
          className="text-blue-600 hover:text-blue-800 text-xs font-medium"
        >
          Chi tiết →
        </button>
        <div className="flex gap-3">
          <button
            onClick={e => { e.stopPropagation(); onEdit(r); }}
            className="text-yellow-500 hover:text-yellow-700 text-xs"
          >
            Sửa
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(r.id, r.name); }}
            className="text-red-400 hover:text-red-600 text-xs"
          >
            Xóa
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Customers() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('active'); // 'active' | 'trash'
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { search, type: typeFilter, page, limit: 20 };
      if (tab === 'trash') params.deleted = '1';
      const { data } = await api.get('/api/customers', { params });
      setRows(data.data); setTotal(data.total);
    } catch { toast.error('Lỗi tải dữ liệu'); }
    finally { setLoading(false); }
  }, [search, typeFilter, page, tab]);

  useEffect(() => { fetchData(); }, [fetchData]);
  // reset page khi đổi tab
  useEffect(() => { setPage(1); setSearch(''); setTypeFilter(''); }, [tab]);

  const openAdd = () => { setForm(EMPTY_FORM); setEditing(null); setModal('form'); };
  const openEdit = (r) => {
    setForm({ name: r.name, phone: r.phone||'', email: r.email||'', zalo: r.zalo||'', facebook: r.facebook||'', type: r.type, source: r.source||'', interest: r.interest||'', notes: r.notes||'' });
    setEditing(r); setModal('form');
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error('Tên không được trống');
    try {
      if (editing) { await api.put(`/api/customers/${editing.id}`, form); toast.success('Đã cập nhật'); }
      else { await api.post('/api/customers', form); toast.success('Đã thêm khách hàng'); }
      setModal(null); fetchData();
    } catch (err) { toast.error(err.response?.data?.error || 'Lỗi'); }
  };

  const del = async (id, name) => {
    if (!confirm(`Ẩn khách hàng "${name}"?\nĐơn hàng vàn bảo hành vẫn được giữ. Bạn có thể khôi phục trong Thùng rác.`)) return;
    try {
      await api.delete(`/api/customers/${id}`);
      toast.success('Đã ẩn khách hàng'); fetchData();
    } catch (err) { toast.error(err.response?.data?.error || 'Lỗi'); }
  };

  const restore = async (id, name) => {
    try {
      await api.post(`/api/customers/${id}/restore`);
      toast.success(`Đã khôi phục "${name}"`);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.error || 'Lỗi'); }
  };

  const deletePermanent = async (id, name) => {
    if (!confirm(`Xóa vĩnh viễn "${name}"?\nToàn bộ đơn hàng và bảo hành sẽ bị xóa. Không thể hoàn tác!`)) return;
    try {
      await api.delete(`/api/customers/${id}/permanent`);
      toast.success(`Đã xóa vĩnh viễn "${name}"`);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.error || 'Lỗi'); }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-3 md:p-6">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-xl font-bold text-gray-800">👥 Khách hàng <span className="text-gray-400 font-normal text-base">({total})</span></h2>
        {tab === 'active' && <button onClick={openAdd} className="btn-primary">+ Thêm khách hàng</button>}
      </div>

      {/* Tab active / trash */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        <button
          onClick={() => setTab('active')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
            tab === 'active' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          👥 Danh sách
        </button>
        <button
          onClick={() => setTab('trash')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${
            tab === 'trash' ? 'bg-red-500 text-white' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🗑️ Thùng rác
        </button>
      </div>

      {/* Search & filter — chỉ hiện khi active */}
      {tab === 'active' && (
        <div className="flex gap-3 mb-4">
          <input
            className="input flex-1" placeholder="🔍 Tra cứu tên, SĐT, email, Zalo..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          <select className="input w-44" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
            <option value="">Tất cả loại</option>
            <option value="buyer">✅ Đã mua</option>
            <option value="lead">🎯 Tiềm năng</option>
          </select>
        </div>
      )}

      {/* Thùng rác — search nhẹ */}
      {tab === 'trash' && (
        <div className="mb-4">
          <input
            className="input w-full max-w-sm" placeholder="🔍 Tìm trong thùng rác..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          <p className="text-xs text-gray-400 mt-1">💡 Khách hàng bị ẩn. Đơn hàng và bảo hành vẫn được giữ nguyên.</p>
        </div>
      )}

      {/* Card grid */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Đang tải...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {tab === 'trash' ? '🗑️ Thùng rác trống' : 'Không có dữ liệu'}
        </div>
      ) : tab === 'trash' ? (
        /* --- Thùng rác: danh sách dạng table đơn giản --- */
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm opacity-75">
              <div>
                <p className="font-medium text-gray-700">{r.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {r.phone && <span className="mr-3">📞 {r.phone}</span>}
                  {r.email && <span>✉️ {r.email}</span>}
                </p>
                <p className="text-xs text-gray-300 mt-0.5">
                  Ẩn lúc: {r.deleted_at ? new Date(r.deleted_at).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'}
                  {' · '}{r.order_count} đơn
                </p>
              </div>
              <div className="flex gap-2 ml-3 flex-shrink-0">
                <button
                  onClick={() => restore(r.id, r.name)}
                  className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition"
                >
                  ↩️ Khôi phục
                </button>
                <button
                  onClick={() => deletePermanent(r.id, r.name)}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition"
                >
                  🗑️ Xóa vĩnh viễn
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {rows.map(r => (
            <CustomerCard key={r.id} r={r} onEdit={openEdit} onDelete={del} navigate={navigate} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-1 mt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={`px-3 py-1 rounded text-sm ${p === page ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Form modal */}
      {modal === 'form' && (
        <Modal title={editing ? 'Sửa khách hàng' : 'Thêm khách hàng'} onClose={() => setModal(null)}>
          <div className="space-y-3">
            <div>
              <label className="label">Tên khách hàng *</label>
              <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Nguyễn Văn A" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">SĐT</label>
                <input className="input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="09xxxxxxxx" />
              </div>
              <div>
                <label className="label">Loại *</label>
                <select className="input" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                  <option value="lead">🎯 Tiềm năng</option>
                  <option value="buyer">✅ Đã mua</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="email@gmail.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Zalo</label>
                <input className="input" value={form.zalo} onChange={e => setForm({...form, zalo: e.target.value})} placeholder="Số Zalo" />
              </div>
              <div>
                <label className="label">Facebook</label>
                <input className="input" value={form.facebook} onChange={e => setForm({...form, facebook: e.target.value})} placeholder="fb.com/..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Nguồn</label>
                <select className="input" value={form.source} onChange={e => setForm({...form, source: e.target.value})}>
                  <option value="">— Chọn nguồn —</option>
                  <option value="facebook">Facebook</option>
                  <option value="zalo">Zalo</option>
                  <option value="tiktok">TikTok</option>
                  <option value="referral">Giới thiệu</option>
                  <option value="website">Website</option>
                  <option value="other">Khác</option>
                </select>
              </div>
              <div>
                <label className="label">Quan tâm SP</label>
                <input className="input" value={form.interest} onChange={e => setForm({...form, interest: e.target.value})} placeholder="Evoto, Adobe..." />
              </div>
            </div>
            <div>
              <label className="label">Ghi chú</label>
              <textarea className="input" rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Ghi chú nội bộ..." />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModal(null)} className="btn-secondary">Hủy</button>
              <button onClick={save} className="btn-primary">💾 Lưu</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
