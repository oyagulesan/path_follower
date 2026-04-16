import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n';
import toast from 'react-hot-toast';

export default function Login() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t, locale, changeLocale } = useI18n();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(userId, password);
      navigate(user.role === 'ADMIN' ? '/admin/tasks' : '/my-tasks');
    } catch {
      toast.error(t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <form onSubmit={handleSubmit} className="login-form">
        <div className="login-header">
          <h1>{t('app.name')}</h1>
          <button
            type="button"
            className="lang-switch"
            onClick={() => changeLocale(locale === 'tr' ? 'en' : 'tr')}
          >
            {locale === 'tr' ? 'EN' : 'TR'}
          </button>
        </div>
        <input
          type="text"
          placeholder={t('auth.userId')}
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder={t('auth.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? t('auth.loggingIn') : t('auth.login')}
        </button>
      </form>
    </div>
  );
}
