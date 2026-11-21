import { Router, match, useRouter } from './lib/router.jsx';
import { AppProvider, useApp } from './lib/store.jsx';
import { useEffect } from 'react';
import { Spinner } from './components/ui.jsx';
import Landing from './pages/Landing.jsx';
import { Login, Signup } from './pages/Auth.jsx';
import Events from './pages/Events.jsx';
import NewEvent from './pages/NewEvent.jsx';
import Manage from './pages/Manage.jsx';
import EventPage from './pages/EventPage.jsx';
import OrderPage from './pages/OrderPage.jsx';
import NotFound from './pages/NotFound.jsx';

// Which page to show for which URL. Order matters: the first match wins.
const routes = [
  ['/', Landing],
  ['/login', Login],
  ['/signup', Signup],
  ['/events', Events, { auth: true }],
  ['/events/new', NewEvent, { auth: true }],
  ['/events/:code', Manage, { auth: true }],
  ['/e/:code', EventPage],
  ['/o/:token', OrderPage],
];

function Pages() {
  const { path, navigate } = useRouter();
  const { user } = useApp();

  let page = null;
  for (const [pattern, Component, opts = {}] of routes) {
    const params = match(pattern, path);
    if (params) { page = { Component, params, opts }; break; }
  }

  // Celebrant pages need a login. Wait until we know who the user is.
  const needsLogin = page?.opts.auth && user === null;
  useEffect(() => {
    if (needsLogin) navigate('/login?next=' + encodeURIComponent(path), { replace: true });
  }, [needsLogin, path, navigate]);

  if (!page) return <NotFound />;
  if (page.opts.auth && !user) return <Spinner />;
  const { Component, params } = page;
  return <Component {...params} key={path.split('?')[0]} />;
}

export default function App() {
  return (
    <AppProvider>
      <Router>
        <Pages />
      </Router>
    </AppProvider>
  );
}
