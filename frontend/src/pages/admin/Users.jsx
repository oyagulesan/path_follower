import { useState, useEffect } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { useI18n } from '../../i18n';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ userId: '', name: '', lastName: '', telephone: '', password: '', role: 'USER' });
  const { t } = useI18n();

  const fetchUsers = async () => {
    const { data } = await api.get('/users');
    setUsers(data);
  };

  useEffect(() => { fetchUsers(); }, []);

  const resetForm = () => {
    setForm({ userId: '', name: '', lastName: '', telephone: '', password: '', role: 'USER' });
    setEditing(null);
  };

  const handleEdit = (user) => {
    setEditing(user.id);
    setForm({ userId: user.userId, name: user.name, lastName: user.lastName, telephone: user.telephone, password: '', role: user.role });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        await api.put(`/users/${editing}`, payload);
        toast.success(t('users.updated'));
      } else {
        await api.post('/users', form);
        toast.success(t('users.created'));
      }
      resetForm();
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || t('users.errorSaving'));
    }
  };

  const handleDelete = async (id) => {
    if (!confirm(t('users.confirmDelete'))) return;
    try {
      await api.delete(`/users/${id}`);
      toast.success(t('users.deleted'));
      fetchUsers();
    } catch {
      toast.error(t('users.errorDeleting'));
    }
  };

  return (
    <div className="page">
      <h2>{t('users.title')}</h2>

      <form onSubmit={handleSubmit} className="form-card">
        <h3>{editing ? t('users.editUser') : t('users.addUser')}</h3>
        <div className="form-grid">
          <input
            placeholder={t('users.userId')}
            value={form.userId}
            onChange={(e) => setForm({ ...form, userId: e.target.value })}
            required
          />
          <input
            placeholder={t('users.name')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            placeholder={t('users.lastName')}
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            required
          />
          <input
            placeholder={t('users.telephone')}
            value={form.telephone}
            onChange={(e) => setForm({ ...form, telephone: e.target.value })}
            required
          />
          <input
            type="password"
            placeholder={editing ? t('users.newPassword') : t('users.password')}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={!editing}
          />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="USER">{t('users.roleUser')}</option>
            <option value="ADMIN">{t('users.roleAdmin')}</option>
          </select>
        </div>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary">{editing ? t('common.update') : t('common.create')}</button>
          {editing && <button type="button" className="btn" onClick={resetForm}>{t('common.cancel')}</button>}
        </div>
      </form>

      <table className="data-table">
        <thead>
          <tr>
            <th>{t('users.userId')}</th>
            <th>{t('users.name')}</th>
            <th>{t('users.lastName')}</th>
            <th>{t('users.telephone')}</th>
            <th>{t('users.role')}</th>
            <th>{t('common.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.userId}</td>
              <td>{u.name}</td>
              <td>{u.lastName}</td>
              <td>{u.telephone}</td>
              <td>{u.role}</td>
              <td>
                <button className="btn btn-sm" onClick={() => handleEdit(u)}>{t('common.edit')}</button>
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(u.id)}>{t('common.delete')}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
