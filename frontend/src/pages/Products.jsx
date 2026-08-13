import { useEffect, useState } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';

const EMPTY = { name: '', duration_months: 1, price: '', cost_price: '', description: '' };

export default function Products() {
  const [rows, setRows]       = useState([]);
  const [modal, setModal]     = useState(false);
  const [form, setForm]       = useState(EMPTY);
  const [editing, setEditing] = useState(null);

  const fetchData = () => api.get('/api/products').then(r => setRows(r.data)).catch(() => {});
  useEffect(() => { fetchData(); }, []);

  const openAdd  = () => { setForm(EMPTY); setEditing(null); setModal(true); };
  const openEdit = r => {
    setForm({
      name:            r.name,
      duration_months: r.duration_months,
      price:           r.price,
      cost_price:      r.cost_price ?? '',
      description:     r.description || '',
    });
    setEditing(r); setModal(true);
  };

  const save = async () => {
    if (!form.name || !form.price) return toast.error('Điền tên và giá bán');
    try {
      if (editing) { await api.put(`/api/products/${editing.id}`, form); toast.success('Đã cập nhật'); }
      else         { await api.post('/api/products', form);              toast.success('Đã thêm sản phẩm'); }
      setModal(false); fetchData();
    } catch (err) { toast.error(err.response?.data?.error || 'Lỗi'); }
  };

  const del = async (id, name) => {
    if (!confirm(`Ẩn sản phẩm "${name}"?`)) return;
    await api.delete(`/api/products/${id}`); toast.success('Đã ẩn'); fetchData();
  };

  const fmtMoney = v => v ? new Intl.NumberFormat('vi-VN').format(v) + 'đ' : '—';

  return (
    <div className="p-3 md:p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">🛍️ Sản phẩm ({rows.length})</h2>
        <button onClick={openAdd} className="btn-primary">+ Thêm sản phẩm</button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b text-gray-500 text-xs uppercase">
            <tr>{['Tên sản phẩm', 'Thời hạn', 'Giá bán', 'Giá nhập', 'Lợi nhuận/đơn', 'Mô tả', 'Thao tác'].map(h =>
              <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map(r => {
              const profit = r.cost_price != null ? r.price - r.cost_price : null;
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-gray-600">{r.duration_months} tháng</td>
                  <td className="px-4 py-3 text-green-600 font-medium">{fmtMoney(r.price)}</td>
                  <td className="px-4 py-3 text-gray-500">{fmtMoney(r.cost_price)}</td>
                  <td className="px-4 py-3">
                    {profit != null ? (
                      <span className={profit >= 0 ? 'text-emerald-600 font-medium' : 'text-red-500 font-medium'}>
                        {profit >= 0 ? '+' : ''}{fmtMoney(profit)}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{r.description || '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => openEdit(r)} className="text-blue-500 hover:underline mr-3">Sửa</button>
                    <button onClick={() => del(r.id, r.name)} className="text-red-400 hover:underline">Ẩn</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm'} onClose={() => setModal(false)} size="sm">
          <div className="space-y-3">
            <div>
              <label className="label">Tên sản phẩm *</label>
              <input className="input" value={form.name}
                onChange={e => setForm({...form, name: e.target.value})} placeholder="Evoto Pro" />
            </div>

            {/* Giá bán + Giá nhập */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Giá bán (VNĐ) *</label>
                <input type="number" className="input" value={form.price}
                  onChange={e => setForm({...form, price: e.target.value})} placeholder="150000" />
              </div>
              <div>
                <label className="label">Giá nhập (VNĐ)</label>
                <input type="number" className="input" value={form.cost_price}
                  onChange={e => setForm({...form, cost_price: e.target.value})} placeholder="100000" />
              </div>
            </div>

            {/* Preview lợi nhuận */}
            {form.price && form.cost_price && (
              <div className="px-3 py-2 bg-emerald-50 rounded-lg text-sm text-emerald-700 font-medium">
                💰 Lợi nhuận/đơn: {new Intl.NumberFormat('vi-VN').format(
                  (parseFloat(form.price) || 0) - (parseFloat(form.cost_price) || 0)
                )}đ
              </div>
            )}

            <div>
              <label className="label">Thời hạn (tháng)</label>
              <input type="number" min={1} className="input" value={form.duration_months}
                onChange={e => setForm({...form, duration_months: e.target.value})} />
            </div>
            <div>
              <label className="label">Mô tả</label>
              <input className="input" value={form.description}
                onChange={e => setForm({...form, description: e.target.value})} />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setModal(false)} className="btn-secondary">Hủy</button>
              <button onClick={save} className="btn-primary">💾 Lưu</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
