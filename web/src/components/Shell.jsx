import { Link, useRouter } from '../lib/router.jsx';
import { useApp } from '../lib/store.jsx';
import { Avatar, Logo } from './ui.jsx';
import Icon from './Icon.jsx';

/** Header for public pages: the landing page, login, and the pages guests see. */
export function PublicShell({ children, wide, minimal }) {
  const { user } = useApp();
  return (
    <div className="pub">
      <header className="pub-head">
        <div className="container pub-head-in">
          <Link to="/" className="brand-link" aria-label="Aso-ebi home"><Logo /></Link>
          {!minimal && (
            <nav className="pub-nav">
              {user ? (
                <Link to="/events" className="btn btn-primary btn-sm">My events</Link>
              ) : (
                <>
                  <Link to="/login" className="link-quiet">Log in</Link>
                  <Link to="/signup" className="btn btn-primary btn-sm">Start for free</Link>
                </>
              )}
            </nav>
          )}
        </div>
      </header>
      <main className={wide ? '' : 'container pub-main'}>{children}</main>
      <footer className="pub-foot">
        <div className="container">
          <p><strong>Aso-ebi</strong> keeps the record. It never holds money: guests pay the celebrant directly.</p>
          <p>Built by <a href="https://ejikepius.dev">Ejike Pius</a> · <a href="https://x.com/ejike_pius">@ejike_pius</a> · <a href="https://github.com/pius-developer/asoebi">GitHub</a></p>
        </div>
      </footer>
    </div>
  );
}

/** The celebrant's app: sidebar on desktop, top bar + bottom tabs on phones. */
export function AppShell({ children, tabs, active, onTab }) {
  const { user, logout } = useApp();
  const { path, navigate } = useRouter();
  const nav = [
    { to: '/events', icon: 'grid', label: 'My events' },
    { to: '/events/new', icon: 'plus', label: 'New event' },
  ];
  return (
    <div className="app">
      <aside className="side">
        <Link to="/events" className="brand-link"><Logo /></Link>
        <nav className="side-nav">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className={path === n.to ? 'on' : ''}><Icon name={n.icon} />{n.label}</Link>
          ))}
        </nav>
        <div className="side-user">
          <Avatar name={user?.name || ''} size={36} />
          <div><strong>{user?.name}</strong><span>{user?.email}</span></div>
          <button className="icon-btn" aria-label="Log out" title="Log out" onClick={async () => { await logout(); navigate('/'); }}><Icon name="logout" size={18} /></button>
        </div>
      </aside>

      <header className="app-top">
        <Link to="/events" className="brand-link"><Logo small /></Link>
        <div className="app-top-actions">
          <Link to="/events/new" className="icon-btn icon-btn-primary" aria-label="New event"><Icon name="plus" /></Link>
          <button className="icon-btn" aria-label="Log out" onClick={async () => { await logout(); navigate('/'); }}><Icon name="logout" size={18} /></button>
        </div>
      </header>

      <main className="app-main">{children}</main>

      {tabs && (
        <nav className="tabbar" aria-label="Sections">
          {tabs.map((t) => (
            <button key={t.key} className={active === t.key ? 'on' : ''} onClick={() => onTab(t.key)} aria-current={active === t.key ? 'page' : undefined}>
              <Icon name={t.icon} size={22} />
              <span>{t.label}</span>
              {t.badge ? <b className="tab-badge">{t.badge}</b> : null}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
