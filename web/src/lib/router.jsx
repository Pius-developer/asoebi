// A tiny router (about 40 lines) so you can see how client-side routing works.
// The browser URL changes with history.pushState, and React re-renders the matching page.
// PHP sends index.html for every page URL, so refreshing /e/abc12345 still works.
import { createContext, useContext, useEffect, useState } from 'react';

const RouterContext = createContext({ path: '/', navigate: () => {} });

export function Router({ children }) {
  const [path, setPath] = useState(window.location.pathname + window.location.search);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname + window.location.search);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = (to, { replace = false } = {}) => {
    if (to === window.location.pathname + window.location.search) return;
    window.history[replace ? 'replaceState' : 'pushState']({}, '', to);
    setPath(to);
    window.scrollTo(0, 0);
  };

  return <RouterContext.Provider value={{ path, navigate }}>{children}</RouterContext.Provider>;
}

export const useRouter = () => useContext(RouterContext);

/** Match "/e/:code" against "/e/abc12345" → { code: "abc12345" } (or null). */
export function match(pattern, path) {
  const clean = path.split('?')[0].replace(/\/+$/, '') || '/';
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
  const m = clean.match(re);
  return m ? Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) : null;
}

/** Like <a>, but changes page without reloading. Ctrl/Cmd-click still opens a new tab. */
export function Link({ to, onClick, ...props }) {
  const { navigate } = useRouter();
  return (
    <a
      href={to}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || props.target) return;
        e.preventDefault();
        navigate(to);
      }}
      {...props}
    />
  );
}
