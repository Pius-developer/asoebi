// App-wide state: who is logged in, plus small toast messages.
// On start we ask PHP "who am I?" (/api/me). PHP answers from its session cookie
// and also gives us the CSRF token that api.js sends with every change.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setCsrf } from './api.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still checking, null = logged out
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    api.get('/api/me')
      .then(({ user, csrf }) => { setCsrf(csrf); setUser(user); })
      .catch(() => setUser(null));
  }, []);

  const toast = useCallback((message, tone = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const logout = async () => {
    await api.post('/api/logout');
    const { csrf } = await api.get('/api/me'); // the session changed, so get a fresh token
    setCsrf(csrf);
    setUser(null);
  };

  return (
    <AppContext.Provider value={{ user, setUser, toast, logout }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast toast-${t.tone}`}>{t.message}</div>)}
      </div>
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
