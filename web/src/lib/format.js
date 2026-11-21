export const naira = (n) => '₦' + Math.round(n || 0).toLocaleString('en-NG');

export const niceDate = (ymd, opts = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  ymd ? new Date(ymd + 'T12:00:00').toLocaleDateString('en-GB', opts) : '';

export const longDate = (ymd) => niceDate(ymd, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Whole days from today until a Y-m-d date (Lagos time is close enough for a countdown). */
export function daysUntil(ymd) {
  const t = new Date(); t.setHours(12, 0, 0, 0);
  return Math.round((new Date(ymd + 'T12:00:00') - t) / 86400000);
}

export function ago(utc) {
  if (!utc) return '';
  const s = (Date.now() - new Date(utc.replace(' ', 'T') + 'Z')) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  if (s < 604800) return Math.floor(s / 86400) + ' d ago';
  return new Date(utc.replace(' ', 'T') + 'Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?';

export const whatsapp = (text, phone = '') => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

export const STATUS = {
  unpaid: { label: 'Not paid', tone: 'muted' },
  claimed: { label: 'To confirm', tone: 'warn' },
  paid: { label: 'Paid', tone: 'ok' },
  rejected: { label: 'Not received', tone: 'bad' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
};

// Small "remember on this device" helpers. Storage can be blocked, so never let it crash the app.
export function remember(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}
export function recall(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
