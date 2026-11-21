import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { Link, useRouter } from '../lib/router.jsx';
import { AppShell } from '../components/Shell.jsx';
import EventForm from '../components/EventForm.jsx';
import Icon from '../components/Icon.jsx';
import { Avatar, Button, Copy, Empty, Field, PhotoPicker, Pill, Sheet, Spinner, Swatches } from '../components/ui.jsx';
import { STATUS, ago, daysUntil, longDate, naira, whatsapp } from '../lib/format.js';

const TABS = [
  { key: 'overview', icon: 'grid', label: 'Overview' },
  { key: 'orders', icon: 'list', label: 'Orders' },
  { key: 'fabrics', icon: 'fabric', label: 'Fabrics' },
  { key: 'settings', icon: 'settings', label: 'Settings' },
];

export default function Manage({ code }) {
  const { navigate } = useRouter();
  const { toast } = useApp();
  const [event, setEvent] = useState(null);
  const [err, setErr] = useState(null);
  const [tab, setTabState] = useState(() => new URLSearchParams(window.location.search).get('tab') || 'overview');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.get(`/api/events/${code}`).then((r) => setEvent(r.event)).catch(setErr);
  }, [code]);

  const setTab = (t, f) => {
    setTabState(t);
    if (f) setFilter(f);
    window.history.replaceState({}, '', `/events/${code}${t === 'overview' ? '' : '?tab=' + t}`);
    window.scrollTo(0, 0);
  };

  /** Run an action that returns the updated event, then show a message. */
  const run = useCallback(async (fn, okMessage) => {
    try {
      const r = await fn();
      if (r?.event) setEvent(r.event);
      if (okMessage) toast(okMessage);
      return true;
    } catch (x) {
      toast(x.message, 'bad');
      return false;
    }
  }, [toast]);

  if (err) return <AppShell><div className="alert">{err.message}</div><Link to="/events">Back to your events</Link></AppShell>;
  if (!event) return <AppShell><Spinner /></AppShell>;

  const tabs = TABS.map((t) => (t.key === 'orders' ? { ...t, badge: event.stats.to_confirm } : t));
  const shareUrl = `${window.location.origin}/e/${event.code}`;

  return (
    <AppShell tabs={tabs} active={tab} onTab={setTab}>
      <div className="m-head">
        <button className="back-link" onClick={() => navigate('/events')}><Icon name="back" size={16} />All events</button>
        <div className="m-title">
          <div>
            <h1>{event.title}</h1>
            <p className="muted"><Icon name="calendar" size={15} /> {longDate(event.event_date)}{event.venue && <> · <Icon name="pin" size={15} /> {event.venue}</>}</p>
          </div>
          <Pill tone={event.is_open ? 'ok' : 'warn'}>{event.is_open ? 'Taking orders' : 'Orders closed'}</Pill>
        </div>
        <div className="share-bar">
          <div className="share-url"><Icon name="share" size={16} /><code>{shareUrl.replace(/^https?:\/\//, '')}</code></div>
          <div className="share-actions">
            <Copy text={shareUrl} label="Copy link" />
            <a className="btn btn-wa btn-sm" target="_blank" rel="noopener" href={whatsapp(`Our aso-ebi for ${event.title} is ready 💜\n\nPick your fabric and order here:\n${shareUrl}`)}><Icon name="wa" size={16} />Share</a>
            <a className="btn btn-ghost btn-sm" href={`/e/${event.code}`} target="_blank" rel="noopener"><Icon name="eye" size={16} />View page</a>
          </div>
        </div>
        <nav className="m-tabs" aria-label="Sections">
          {tabs.map((t) => (
            <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
              <Icon name={t.icon} size={18} />{t.label}{t.badge ? <b className="tab-badge">{t.badge}</b> : null}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'overview' && <Overview event={event} setTab={setTab} />}
      {tab === 'orders' && <Orders event={event} run={run} filter={filter} setFilter={setFilter} />}
      {tab === 'fabrics' && <Fabrics event={event} run={run} />}
      {tab === 'settings' && <Settings event={event} run={run} setEvent={setEvent} />}
    </AppShell>
  );
}

// ---- Overview -------------------------------------------------------------

function Overview({ event, setTab }) {
  const s = event.stats;
  const pct = s.expected ? Math.round((s.raised / s.expected) * 100) : 0;
  const days = daysUntil(event.event_date);
  const sideMax = Math.max(1, ...Object.values(s.sides));

  return (
    <div className="ov">
      {event.fabrics.length === 0 && (
        <div className="callout">
          <div><h3>Add your fabrics first</h3><p>Guests can't order until there's at least one fabric with a photo and a price.</p></div>
          <Button icon="plus" onClick={() => setTab('fabrics')}>Add fabric</Button>
        </div>
      )}

      <section className="kpis">
        <div className="kpi kpi-main">
          <span>Confirmed so far</span>
          <b>{naira(s.raised)}</b>
          <div className="bar bar-light"><i style={{ width: pct + '%' }} /></div>
          <small>{pct}% of {naira(s.expected)} ordered</small>
        </div>
        <button className="kpi kpi-btn" onClick={() => setTab('orders', 'claimed')}>
          <span>To confirm</span><b className={s.to_confirm ? 'attn' : ''}>{s.to_confirm}</b><small>Guests who said they paid</small>
        </button>
        <button className="kpi kpi-btn" onClick={() => setTab('orders', 'unpaid')}>
          <span>Not paid yet</span><b>{s.unpaid}</b><small>Send them a reminder</small>
        </button>
        <button className="kpi kpi-btn" onClick={() => setTab('orders', 'paid')}>
          <span>Collected</span><b>{s.collected}<em>/{s.paid}</em></b><small>Paid guests with their fabric</small>
        </button>
      </section>

      <div className="ov-grid">
        <section className="card">
          <div className="card-title"><h2>Fabric</h2><button className="link-btn" onClick={() => setTab('fabrics')}>Manage</button></div>
          {event.fabrics.length === 0 && <p className="muted small">No fabrics yet.</p>}
          <div className="stock-list">
            {event.fabrics.map((f) => {
              const of = f.stock ?? Math.max(f.ordered, 1);
              return (
                <div key={f.id} className="stock">
                  <span className="dot" style={{ background: f.color }} />
                  <div className="stock-main">
                    <div className="stock-top"><strong>{f.name}</strong><span>{f.ordered}{f.stock !== null ? ` of ${f.stock}` : ''} ordered</span></div>
                    <div className="bar"><i style={{ width: Math.min(100, (f.ordered / of) * 100) + '%', background: f.color }} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card">
          <div className="card-title"><h2>Who's wearing our colours</h2><span className="muted small">{s.people} people</span></div>
          <div className="tally">
            {Object.entries(s.sides).map(([side, n]) => (
              <div key={side} className="tally-row">
                <span>{side}</span>
                <div className="bar"><i style={{ width: (n / sideMax) * 100 + '%' }} /></div>
                <b>{n}</b>
              </div>
            ))}
          </div>
          <p className="muted small mt-12">{days > 0 ? `${days} days to go.` : days === 0 ? 'It\'s today! 🎉' : 'The event has passed.'} Counts guests who have paid or said they've paid.</p>
        </section>

        <section className="card ov-wide">
          <div className="card-title"><h2>Recent activity</h2></div>
          {event.log.length === 0 ? <p className="muted small">Nothing yet.</p> : (
            <ul className="activity">
              {event.log.slice(0, 8).map((l, i) => (
                <li key={i}><span className={`act-dot act-${l.action}`} /><p>{['ordered', 'claimed'].includes(l.action) && <b>{l.actor} </b>}{['ordered', 'claimed'].includes(l.action) ? l.detail.charAt(0).toLowerCase() + l.detail.slice(1) : l.detail}</p><time>{ago(l.created_at)}</time></li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

// ---- Orders ---------------------------------------------------------------

const FILTERS = [
  ['all', 'All'], ['claimed', 'To confirm'], ['unpaid', 'Not paid'], ['paid', 'Paid'], ['collected', 'Collected'], ['cancelled', 'Cancelled'],
];

function Orders({ event, run, filter, setFilter }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [receipt, setReceipt] = useState(null);

  const counts = useMemo(() => {
    const c = { all: 0, claimed: 0, unpaid: 0, paid: 0, collected: 0, cancelled: 0 };
    for (const o of event.orders) {
      if (o.status !== 'cancelled') c.all++;
      if (o.status === 'unpaid' || o.status === 'rejected') c.unpaid++; else c[o.status]++;
      if (o.collected) c.collected++;
    }
    return c;
  }, [event.orders]);

  const list = event.orders.filter((o) => {
    if (filter === 'all' && o.status === 'cancelled') return false;
    if (filter === 'unpaid' && !['unpaid', 'rejected'].includes(o.status)) return false;
    if (filter === 'collected' && !o.collected) return false;
    if (!['all', 'unpaid', 'collected'].includes(filter) && o.status !== filter) return false;
    const t = q.trim().toLowerCase();
    return !t || o.name.toLowerCase().includes(t) || o.ref.toLowerCase().includes(t) || o.phone.replace(/\s/g, '').includes(t.replace(/\s/g, ''));
  });

  const act = (o, action, msg) => run(() => api.post(`/api/events/${event.code}/orders/${o.id}/${action}`), msg);
  const remind = (o) => whatsapp(`Hi ${o.name.split(' ')[0]} 👋 Just a reminder about your aso-ebi for ${event.title}: ${naira(o.total)} (ref ${o.ref}). Here's your order with the payment details: ${window.location.origin}${o.link}`, o.wa);

  return (
    <div>
      <div className="toolbar">
        <div className="search"><Icon name="search" size={18} /><input placeholder="Search name, phone or ref" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search orders" /></div>
        <a className="btn btn-ghost btn-sm" href={`/api/events/${event.code}/export.csv`}><Icon name="download" size={16} />Export CSV</a>
      </div>
      <div className="filters" role="tablist">
        {FILTERS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={filter === k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>
            {label}<span className="chip-n">{counts[k]}</span>
          </button>
        ))}
      </div>

      {event.orders.length === 0 ? (
        <Empty icon="bag" title="No orders yet" action={<Copy text={`${window.location.origin}/e/${event.code}`} label="Copy your link" variant="primary" size={null} />}>
          Share your link on WhatsApp. Orders will show up here as soon as guests start picking fabric.
        </Empty>
      ) : list.length === 0 ? (
        <p className="muted center pad">No orders match.</p>
      ) : (
        <ul className="orders">
          {list.map((o) => {
            const st = STATUS[o.status];
            const isOpen = open === o.id;
            return (
              <li key={o.id} className={`order ${isOpen ? 'open' : ''} ${o.status === 'claimed' ? 'is-attn' : ''}`}>
                <button className="order-row" onClick={() => setOpen(isOpen ? null : o.id)} aria-expanded={isOpen}>
                  <Avatar name={o.name} />
                  <div className="order-main">
                    <strong>{o.name}</strong>
                    <span>{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</span>
                  </div>
                  <div className="order-side hide-xs"><span className="muted small">{o.side || '—'}</span></div>
                  <div className="order-end">
                    <b>{naira(o.total)}</b>
                    <span className="order-pills">
                      <Pill tone={st.tone}>{st.label}</Pill>
                      {o.collected && <Pill tone="brand">Collected</Pill>}
                    </span>
                  </div>
                </button>
                {isOpen && (
                  <div className="order-detail">
                    <dl>
                      <div><dt>Ref</dt><dd>{o.ref}</dd></div>
                      <div><dt>Phone</dt><dd><a href={`tel:+${o.wa}`}>{o.phone}</a></dd></div>
                      <div><dt>Side</dt><dd>{o.side || '—'}</dd></div>
                      <div><dt>Ordered</dt><dd>{ago(o.created_at)}</dd></div>
                      {o.note && <div className="full"><dt>Note</dt><dd>“{o.note}”</dd></div>}
                    </dl>
                    <div className="btn-row">
                      {o.receipt && <Button variant="ghost" size="sm" icon="receipt" onClick={() => setReceipt(o)}>View receipt</Button>}
                      {['claimed', 'unpaid', 'rejected'].includes(o.status) && <Button size="sm" icon="check" onClick={() => act(o, 'confirm', `${o.name.split(' ')[0]}'s payment confirmed`)}>{o.status === 'claimed' ? 'Confirm payment' : 'Mark as paid'}</Button>}
                      {o.status === 'claimed' && <Button variant="danger" size="sm" onClick={() => confirm(`Tell ${o.name} you haven't received their payment?`) && act(o, 'reject', 'Marked as not received')}>Not received</Button>}
                      {o.status !== 'cancelled' && (o.collected
                        ? <Button variant="ghost" size="sm" onClick={() => act(o, 'uncollect', 'Marked as not collected')}>Undo collected</Button>
                        : <Button variant="soft" size="sm" icon="bag" onClick={() => act(o, 'collected', `${o.name.split(' ')[0]} collected their fabric`)}>Mark collected</Button>)}
                      {['unpaid', 'rejected'].includes(o.status) && <a className="btn btn-wa btn-sm" target="_blank" rel="noopener" href={remind(o)}><Icon name="wa" size={16} />Remind</a>}
                      {!['paid', 'cancelled'].includes(o.status) && <Button variant="text" size="sm" onClick={() => confirm(`Cancel ${o.name}'s order? Their fabric goes back into stock.`) && act(o, 'cancel', 'Order cancelled')}>Cancel order</Button>}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={!!receipt} onClose={() => setReceipt(null)} title={receipt ? `${receipt.name}'s receipt` : ''}
        footer={receipt?.status === 'claimed' && (
          <div className="btn-row">
            <Button variant="danger" onClick={async () => { if (await act(receipt, 'reject', 'Marked as not received')) setReceipt(null); }}>Not received</Button>
            <Button icon="check" onClick={async () => { if (await act(receipt, 'confirm', 'Payment confirmed')) setReceipt(null); }}>Confirm {receipt && naira(receipt.total)}</Button>
          </div>
        )}>
        {receipt && <img className="receipt-img" src={receipt.receipt} alt={`Payment receipt from ${receipt.name}`} />}
      </Sheet>
    </div>
  );
}

// ---- Fabrics --------------------------------------------------------------

const PRESETS = ['#7C3AED', '#C026D3', '#DB2777', '#DC2626', '#EA580C', '#D4A017', '#16A34A', '#0D9488', '#2563EB', '#1E293B', '#F5F0E6', '#8B5E3C'];

function Fabrics({ event, run }) {
  const [editing, setEditing] = useState(null); // null | {} (new) | fabric

  return (
    <div>
      <div className="section-head">
        <div><h2>Fabrics</h2><p className="muted small">What guests can order. Good photos sell fabric.</p></div>
        <Button icon="plus" onClick={() => setEditing({})}>Add fabric</Button>
      </div>
      {event.fabrics.length === 0 ? (
        <Empty icon="fabric" title="No fabrics yet" action={<Button icon="plus" onClick={() => setEditing({})}>Add your first fabric</Button>}>
          For example: Gele + Ipele ₦25,000, Men's fabric ₦18,000, Cap ₦5,000.
        </Empty>
      ) : (
        <div className="fab-grid">
          {event.fabrics.map((f) => (
            <button key={f.id} className="fab-card" onClick={() => setEditing(f)}>
              <div className="fab-img" style={{ background: f.color }}>{f.photo && <img src={f.photo} alt="" />}</div>
              <div className="fab-body">
                <div className="fab-top"><strong>{f.name}</strong><b>{naira(f.price)}</b></div>
                <p className="muted small">{f.stock === null ? `${f.ordered} ordered · no limit` : `${f.ordered} of ${f.stock} ordered · ${f.left} left`}</p>
              </div>
              <span className="fab-edit"><Icon name="edit" size={16} />Edit</span>
            </button>
          ))}
        </div>
      )}
      {editing && <FabricSheet event={event} fabric={editing} run={run} onClose={() => setEditing(null)} />}
    </div>
  );
}

function FabricSheet({ event, fabric, run, onClose }) {
  const isNew = !fabric.id;
  const [f, setF] = useState({
    name: fabric.name || '', description: fabric.description || '', price: fabric.price ? fabric.price.toLocaleString('en-NG') : '',
    stock: fabric.stock ?? '', color: fabric.color || PRESETS[0],
  });
  const [photo, setPhoto] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const fe = (k) => (err?.field === k ? err.message : null);

  const save = async () => {
    setBusy(true); setErr(null);
    // Photos can't go in JSON, so this request uses FormData (multipart), like a normal HTML form.
    const data = new FormData();
    Object.entries(f).forEach(([k, v]) => data.append(k, String(v)));
    if (photo) data.append('photo', photo);
    try {
      const r = await api.post(`/api/events/${event.code}/fabrics${isNew ? '' : '/' + fabric.id}`, data);
      await run(() => Promise.resolve(r), isNew ? 'Fabric added' : 'Fabric saved');
      onClose();
    } catch (x) { setErr(x); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!confirm(`Remove ${fabric.name}?`)) return;
    if (await run(() => api.post(`/api/events/${event.code}/fabrics/${fabric.id}/delete`), 'Fabric removed')) onClose();
  };

  return (
    <Sheet open onClose={onClose} title={isNew ? 'Add fabric' : 'Edit fabric'}
      footer={<div className="btn-row">{!isNew && <Button variant="text" icon="trash" onClick={remove}>Remove</Button>}<Button loading={busy} icon="check" onClick={save}>{isNew ? 'Add fabric' : 'Save'}</Button></div>}>
      <div className="form">
        {err && !err.field && <div className="alert">{err.message}</div>}
        <PhotoPicker current={fabric.photo} onFile={setPhoto} label="Add a photo of the fabric" error={fe('photo')} />
        {fe('photo') && <span className="err">{fe('photo')}</span>}
        <Field label="Name" name="fname" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Gele + Ipele" error={fe('name')} maxLength={60} />
        <div className="grid-2">
          <Field label="Price" name="price" inputMode="numeric" prefix="₦" value={f.price} onChange={(e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 7); setF({ ...f, price: d ? Number(d).toLocaleString('en-NG') : '' }); }} error={fe('price')} />
          <Field label="How many?" name="stock" type="number" min="0" inputMode="numeric" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} hint="Empty = no limit" error={fe('stock')} />
        </div>
        <Field as="textarea" rows={2} label="Description (optional)" name="description" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="e.g. 5 yards of lace with matching gele" maxLength={200} />
        <div className="field">
          <span className="label">Colour</span>
          <div className="colors">
            {PRESETS.map((c) => <button type="button" key={c} className={`color ${f.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setF({ ...f, color: c })} aria-label={`Colour ${c}`} />)}
            <label className="color color-custom" title="Pick any colour"><input type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value.toUpperCase() })} aria-label="Pick any colour" /><Icon name="plus" size={14} /></label>
          </div>
          <span className="hint">Used on your page and the share card.</span>
        </div>
      </div>
    </Sheet>
  );
}

// ---- Settings -------------------------------------------------------------

function Settings({ event, run, setEvent }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const save = async (data) => {
    setBusy(true); setError(null);
    try { const r = await api.post(`/api/events/${event.code}`, data); setEvent(r.event); await run(() => Promise.resolve(null), 'Saved'); }
    catch (x) { setError(x); } finally { setBusy(false); }
  };
  const cover = async (file) => {
    const d = new FormData(); d.append('photo', file);
    await run(() => api.post(`/api/events/${event.code}/cover`, d), 'Cover photo updated');
  };

  return (
    <div className="settings">
      <section className="card">
        <h2>Cover photo</h2>
        <p className="muted small">The first thing guests see. A photo of the couple, the celebrant or the fabric works best.</p>
        <div className="mt-12"><PhotoPicker current={event.cover} onFile={cover} label="Add a cover photo" /></div>
      </section>
      <section className="card">
        <h2>Orders</h2>
        <p className="muted small">{event.is_open ? 'Guests can order now.' : 'Guests can see the page but can\'t order.'}{event.deadline && ` Orders close automatically after ${longDate(event.deadline)}.`}</p>
        <div className="mt-12">
          {event.status === 'open'
            ? <Button variant="ghost" icon="lock" onClick={() => run(() => api.post(`/api/events/${event.code}/status`, { status: 'closed' }), 'Orders closed')}>Close orders now</Button>
            : <Button icon="check" onClick={() => run(() => api.post(`/api/events/${event.code}/status`, { status: 'open' }), 'Orders open again')}>Open orders</Button>}
        </div>
      </section>
      <section className="card">
        <h2>Event details</h2>
        <EventForm key={event.code} initial={{ ...event, deadline: event.deadline || '' }} onSubmit={save} busy={busy} error={error} submitLabel="Save changes" />
      </section>
    </div>
  );
}
