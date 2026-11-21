import { useState } from 'react';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { Link, useRouter } from '../lib/router.jsx';
import { PublicShell } from '../components/Shell.jsx';
import { Button, Field } from '../components/ui.jsx';

function useNext() {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/events';
}

export function Login() {
  const { setUser } = useApp();
  const { navigate } = useRouter();
  const next = useNext();
  const [form, setForm] = useState({ email: '', password: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const { user } = await api.post('/api/login', form);
      setUser(user);
      navigate(next, { replace: true });
    } catch (x) { setErr(x); } finally { setBusy(false); }
  };

  return (
    <PublicShell>
      <div className="auth">
        <h1>Welcome back</h1>
        <p className="lead">Log in to manage your aso-ebi.</p>
        <form onSubmit={submit} className="form" noValidate>
          {err && !err.field && <div className="alert">{err.message}</div>}
          <Field label="Email" name="email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={err?.field === 'email' && err.message} />
          <Field label="Password" name="password" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={err?.field === 'password' && err.message} />
          <Button type="submit" block loading={busy}>Log in</Button>
          <p className="small muted">New here? <Link to="/signup">Create a free account</Link></p>
          <p className="small muted">Ordering fabric? You don't need an account. Use the link the celebrant shared.</p>
        </form>
      </div>
    </PublicShell>
  );
}

export function Signup() {
  const { setUser } = useApp();
  const { navigate } = useRouter();
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const fe = (k) => err?.field === k ? err.message : null;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const { user } = await api.post('/api/signup', form);
      setUser(user);
      navigate('/events/new', { replace: true });
    } catch (x) { setErr(x); } finally { setBusy(false); }
  };

  return (
    <PublicShell>
      <div className="auth">
        <h1>Start your aso-ebi</h1>
        <p className="lead">Free. Your guests won't need an account.</p>
        <form onSubmit={submit} className="form" noValidate>
          {err && !err.field && <div className="alert">{err.message}</div>}
          <Field label="Your name" name="name" autoComplete="name" value={form.name} onChange={set('name')} error={fe('name')} />
          <Field label="Phone number" name="phone" type="tel" inputMode="tel" placeholder="0803 123 4567" autoComplete="tel" value={form.phone} onChange={set('phone')} error={fe('phone')} />
          <Field label="Email" name="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={fe('email')} />
          <Field label="Password" name="password" type="password" autoComplete="new-password" hint="At least 8 characters." value={form.password} onChange={set('password')} error={fe('password')} />
          <Button type="submit" block loading={busy}>Create account</Button>
          <p className="small muted">Already have an account? <Link to="/login">Log in</Link></p>
        </form>
      </div>
    </PublicShell>
  );
}
