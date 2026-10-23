import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Avatar } from '../components/ui.jsx';

export default function Layout() {
  const { user, logout, notifications, unread, markAllRead } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleClick = (e) => {
      const sidebar = document.getElementById('sidebar');
      if (sidebar && !sidebar.contains(e.target) && !e.target.closest('.menu-btn')) {
        sidebar.classList.add('collapsed');
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  if (!user) return null;

  const buildNav = () => {
    const base = [{ key: 'dashboard', label: 'Dashboard', icon: '📊', path: '/', exact: true }];
    if (user.role === 'mentee') {
      return [
        ...base,
        { key: 'mentors', label: 'Find Mentors', icon: '👥', path: '/mentors' },
        { key: 'connections', label: 'My Mentors', icon: '🤝', path: '/connections' },
        { key: 'messages', label: 'Messages', icon: '💬', path: '/messages' },
        { key: 'meetings', label: 'Meetings', icon: '📅', path: '/meetings' },
        { key: 'goals', label: 'Goals', icon: '🎯', path: '/goals' },
        { key: 'feedback', label: 'Feedback', icon: '💮', path: '/feedback' },
        { key: 'ask-question', label: 'Ask Question', icon: '❓', path: '/ask-question' },
        { key: 'my-questions', label: 'My Questions', icon: '📝', path: '/my-questions' },
        { key: 'profile', label: 'Profile', icon: '👤', path: '/profile' },
      ];
    }
    if (user.role === 'mentor') {
      return [
        ...base,
        { key: 'connections', label: 'My Mentees', icon: '👥', path: '/connections' },
        { key: 'messages', label: 'Messages', icon: '💬', path: '/messages' },
        { key: 'meetings', label: 'Meetings', icon: '📅', path: '/meetings' },
        { key: 'goals', label: 'Goals', icon: '🎯', path: '/goals' },
        { key: 'feedback', label: 'Feedback', icon: '💮', path: '/feedback' },
        { key: 'open-questions', label: 'Open Questions', icon: '💬', path: '/open-questions' },
        { key: 'profile', label: 'Profile', icon: '👤', path: '/profile' },
      ];
    }
    if (user.role === 'admin') {
      return [
        ...base,
        { key: 'admin', label: 'Admin', icon: '🛠️', path: '/admin' },
        { key: 'meetings', label: 'Meetings', icon: '📅', path: '/meetings' },
        { key: 'feedback', label: 'Feedback', icon: '💮', path: '/feedback' },
        { key: 'profile', label: 'Profile', icon: '👤', path: '/profile' },
      ];
    }
    return base;
  };

  const nav = buildNav();
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const isActive = (item) =>
    item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);

  const go = (path) => (e) => {
    e.preventDefault();
    if (isMobile) document.getElementById('sidebar')?.classList.add('collapsed');
    navigate(path);
  };

  return (
    <div className="app">
      <div className="app-inner">
        <header className="topbar">
          <button
            className="menu-btn"
            aria-label="Open menu"
            onClick={(e) => {
              e.stopPropagation();
              document.getElementById('sidebar')?.classList.toggle('collapsed');
            }}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
          <h1 className="logo">App for Hand Holding</h1>
          <div className="topbar-user">
            <Avatar user={user} size={32} />
            <span className="user-name">{user?.name}</span>
            <button className="menu-btn small" onClick={() => logout()}>
              Logout
            </button>
          </div>
          <button
            className="bell-btn"
            aria-label="Notifications"
            onClick={(e) => {
              e.stopPropagation();
              document.getElementById('notif-panel')?.classList.toggle('open');
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 22c1.1 0 2-.9 2-2h-4v-2h4c1.1 0 2-.9 2-2v-6h-2v6c0 1.1.9 2 2 2m0-11c-1.1 0-2 .9-2 2v4h4v-2h-4v2zm0-6c-1.1 0-2 .9-2 2v2h4v-2H12v-4zm1.75 7.75 1.75 2.5 1.4-1.8L15 9.5l-1.37 2.25.52 1.65-1.75-2.5L11 9.25l1.75-2.5z" />
            </svg>
            <span className="notif-dot" style={{ display: unread > 0 ? 'block' : 'none' }} />
          </button>
          <div id="notif-panel" className="notif-panel" onClick={(e) => e.stopPropagation()}>
            <h4>Notifications{unread > 0 ? ` (${unread} unread)` : ''}</h4>
            <ul>
              {notifications.length === 0 && <li className="notif-item">No notifications yet.</li>}
              {notifications.slice(0, 8).map((n, i) => (
                <li key={n._id || i} className="notif-item" style={{ opacity: n.read ? 0.65 : 1 }}>
                  <span className="notif-title">{n.title}</span>
                  <span className="notif-body">{n.body}</span>
                </li>
              ))}
            </ul>
            <button className="mark-all-read" onClick={() => markAllRead()}>
              Mark all read
            </button>
          </div>
        </header>

        <aside id="sidebar" className={`sidebar ${isMobile ? 'mobile' : ''}`}>
          <div className="sidebar-brand">
            <span>Hand Holding</span>
          </div>
          <nav>
            <ul>
              {nav.map((item) => (
                <li key={item.key}>
                  <a href={item.path} className={`sidebar-link ${isActive(item) ? 'active' : ''}`} onClick={go(item.path)}>
                    <span className="sidebar-icon">{item.icon}</span>
                    <span className="sidebar-text">{item.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="main-content">
          <div className="page-content">
            <Outlet />
          </div>
        </main>

        {isMobile && (
          <nav className="bottom-nav" role="navigation">
            <ul>
              {nav
                .filter((n) => n.key !== 'dashboard' || true)
                .slice(0, 7)
                .map((item) => (
                  <li key={item.key}>
                    <a href={item.path} onClick={go(item.path)}>
                      {item.icon} {item.label}
                    </a>
                  </li>
                ))}
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
}