import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';

const EMPTY_FORM = { name: '', phone: '', email: '', zalo: '', facebook: '', type: 'lead', source: '', interest: '', notes: '' };

export default function Customers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
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
      const { data } = await api.get('/api/customers', { params: { search, type: typeFilter, page, limit: 20 } });
      setRows(data.data); setTotal(data.total);
    } catch { toast.error('Lỗi tải dữ liệu'); }
    finally { setLoading(false); }
  }, [search, typeFilter, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
    if (!confirm(`Xóa khách hàng "${name}"? Thao tác này không thể hoàn tác.`)) return;
    await api.delete(`/api/customers/${id}`);
    toast.success('Đã xóa'); fetchData();
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">👥 Khách hàng <span className="text-gray-400 font-normal text-base">({total})</span></h2>
        <button onClick={openAdd} className="btn-primary">+ Thêm khách hàng</button>
      </div>

      {/* Search & filter */}
      <div className="flex gap-3 mb-4">
        <input
          className="input flex-1" placeholder="🔍 Tra cứu tên, SĐT, email, Zalo, mail bảo hành..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
        <select className="input w-44" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}>
          <option value="">Tất cả loại</option>
          <option value="buyer">✅ Đã mua</option>
          <option value="lead">🎯 Tiềm năng</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-gray-500 text-xs uppercase">
              {['Khách hàng', 'SĐT', 'Email/Zalo', 'Loại', 'Đơn hàng', 'Bảo hành', 'Mua đầu', 'Thao tác'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">Đang tải...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-10 text-gray-400">Không có dữ liệu</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <button onClick={() => navigate(`/customers/${r.id}`)} className="font-medium text-blue-600 hover:underline text-left">
                    {r.name}
                  </button>
                  {r.notes && <p className="text-xs text-gray-400 truncate max-w-xs">{r.notes}</p>}
                </td>
                <td className="px-4 py-3 text-gray-600">{r.phone || '—'}</td>
                <td className="px-4 py-3 text-gray-600">
                  <div>{r.email || '—'}</div>
                  {r.zalo && <div className="text-xs text-gray-400">Zalo: {r.zalo}</div>}
                </td>
                <td className="px-4 py-3">
                  <span className={r.type === 'buyer' ? 'badge-buyer' : 'badge-lead'}>
                    {r.type === 'buyer' ? '✅ Đã mua' : '🎯 Tiềm năng'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">{r.order_count || 0}</td>
                <td className="px-4 py-3 text-center">{r.warranty_count || 0}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{r.first_purchase ? new Date(r.first_purchase).toLocaleDateString('vi-VN') : '—'}</td>
                <td className="px-4 py-3">
                  <button onClick={() => navigate(`/customers/${r.id}`)} className="text-blue-500 hover:underline mr-3">Chi tiết</button>
                  <button onClick={() => openEdit(r)} className="text-yellow-500 hover:underline mr-3">Sửa</button>
                  <button onClick={() => del(r.id, r.name)} className="text-red-400 hover:underline">Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-1 mt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)} className={`px-3 py-1 rounded text-sm ${p === page ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>{p}</button>
          ))}
        </div>
      )}

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
