import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { t, locale, changeLocale } = useI18n();

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const linkClass = (path) =>
    `nav-link ${location.pathname === path ? 'active' : ''}`;

  return (
    <nav className="navbar">
      <div className="navbar-brand">{t('app.name')}</div>
      <div className="navbar-links">
        {isAdmin && (
          <>
            <Link to="/admin/users" className={linkClass('/admin/users')}>{t('nav.users')}</Link>
            <Link to="/admin/tasks" className={linkClass('/admin/tasks')}>{t('nav.tasks')}</Link>
          </>
        )}
        <Link to="/my-tasks" className={linkClass('/my-tasks')}>{t('nav.myTasks')}</Link>
        <Link to="/all-tasks" className={linkClass('/all-tasks')}>{t('nav.allTasks')}</Link>
      </div>
      <div className="navbar-user">
        <button
          className="lang-switch"
          onClick={() => changeLocale(locale === 'tr' ? 'en' : 'tr')}
        >
          {locale === 'tr' ? 'EN' : 'TR'}
        </button>
        <span>{user.name} {user.lastName}</span>
        <button onClick={handleLogout} className="btn btn-sm">{t('auth.logout')}</button>
      </div>
    </nav>
  );
}
