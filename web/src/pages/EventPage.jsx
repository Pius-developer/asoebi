import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { Link, useRouter } from '../lib/router.jsx';
import { PublicShell } from '../components/Shell.jsx';
import Icon from '../components/Icon.jsx';
import { Button, Field, Sheet, Spinner, Stepper, Swatches } from '../components/ui.jsx';
import { daysUntil, longDate, naira, niceDate, recall, remember } from '../lib/format.js';
import NotFound from './NotFound.jsx';

export default function EventPage({ code }) {
  const { navigate } = useRouter();
  const [event, setEvent] = useState(null);
  const [err, setErr] = useState(null);
  const [cart, setCart] = useState({});
  const [checkout, setCheckout] = useState(false);
  const mine = recall('asoebi:orders', {})[code] || [];

  useEffect(() => {
    api.get(`/api/e/${code}`).then((r) => setEvent(r.event)).catch(setErr);
  }, [code]);

  const lines = useMemo(() => (event ? event.fabrics.filter((f) => cart[f.id] > 0).map((f) => ({ ...f, qty: cart[f.id] })) : []), [event, cart]);
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const total = lines.reduce((a, l) => a + l.qty * l.price, 0);

  if (err?.status === 404) return <NotFound title="Event not found" message="This aso-ebi link doesn't work. Ask the celebrant to send it again." />;
  if (err) return <PublicShell><div className="alert">{err.message}</div></PublicShell>;
  if (!event) return <PublicShell><Spinner /></PublicShell>;

  const days = daysUntil(event.event_date);
  const [a, b] = event.sides;
  const tallyA = event.tally[a] || 0, tallyB = event.tally[b] || 0;
  const duel = event.kind === 'wedding' && a && b;

  return (
    <PublicShell wide>
      <section className="ev-hero">
        <div className="container ev-hero-in">
          <div className="ev-cover" style={event.cover ? { backgroundImage: `url(${event.cover})` } : undefined}>
            {!event.cover && <Swatches colors={event.fabrics.map((f) => f.color).concat('#7C3AED', '#C4B5FD')} size={120} />}
          </div>
          <div className="ev-info">
            <p className="ev-kicker">{event.host ? `${event.host} invites you to wear our aso-ebi` : 'Wear our aso-ebi'}</p>
            <h1>{event.title}</h1>
            <div className="ev-meta">
              <span><Icon name="calendar" size={18} />{longDate(event.event_date)}</span>
              {event.venue && <span><Icon name="pin" size={18} />{event.venue}</span>}
            </div>
            <div className="ev-stats">
              <div className="ev-stat"><b>{days > 0 ? days : days === 0 ? '🎉' : '—'}</b><span>{days > 0 ? (days === 1 ? 'day to go' : 'days to go') : days === 0 ? 'It\'s today' : 'Event passed'}</span></div>
              <div className="ev-stat"><b>{event.people}</b><span>{event.people === 1 ? 'person is' : 'people are'} wearing our colours</span></div>
              {event.deadline && event.is_open && <div className="ev-stat"><b>{niceDate(event.deadline, { day: 'numeric', month: 'short' })}</b><span>last day to order</span></div>}
            </div>
          </div>
        </div>
      </section>

      <div className="container ev-body">
        {mine.length > 0 && (
          <div className="mine-banner">
            <Icon name="bag" />
            <span>You ordered from this page before.</span>
            <Link to={`/o/${mine[mine.length - 1]}`} className="btn btn-primary btn-sm">View my order</Link>
          </div>
        )}
        {!event.is_open && <div className="note-box">Orders for this aso-ebi are closed. Contact the celebrant if you still need fabric.</div>}

        {event.people > 0 && (
          <section className="tally-card">
            {duel ? (
              <>
                <div className="duel-head"><span>{a}</span><b>vs</b><span>{b}</span></div>
                <div className="duel">
                  <i style={{ flexGrow: tallyA || 0.0001 }}><b>{tallyA}</b></i>
                  <i style={{ flexGrow: tallyB || 0.0001 }}><b>{tallyB}</b></i>
                </div>
                <p className="muted small">{tallyA === tallyB ? 'It\'s a tie! Who will show up in more colours?' : `${tallyA > tallyB ? a : b} is ahead. Pick your side when you order.`}</p>
              </>
            ) : (
              <div className="tally">
                {event.sides.map((s) => (
                  <div key={s} className="tally-row"><span>{s}</span><div className="bar"><i style={{ width: ((event.tally[s] || 0) / Math.max(1, ...Object.values(event.tally))) * 100 + '%' }} /></div><b>{event.tally[s] || 0}</b></div>
                ))}
              </div>
            )}
          </section>
        )}

        <div className="section-head"><div><h2>Choose your fabric</h2><p className="muted small">Pick what you want, then pay the celebrant directly.</p></div></div>
        {event.fabrics.length === 0 ? <p className="muted">The celebrant hasn't added fabrics yet. Check back soon.</p> : (
          <div className="shop">
            {event.fabrics.map((f) => (
              <article key={f.id} className={`shop-card ${cart[f.id] ? 'in-cart' : ''} ${f.sold_out ? 'sold-out' : ''}`}>
                <div className="shop-img" style={{ background: f.color }}>
                  {f.photo && <img src={f.photo} alt={f.name} loading="lazy" />}
                  {f.sold_out ? <span className="tag tag-dark">Sold out</span> : f.left !== null && f.left <= 5 && <span className="tag">Only {f.left} left</span>}
                </div>
                <div className="shop-body">
                  <h3>{f.name}</h3>
                  {f.description && <p className="muted small">{f.description}</p>}
                  <div className="shop-foot">
                    <b className="price">{naira(f.price)}</b>
                    {event.is_open && !f.sold_out && (
                      cart[f.id]
                        ? <Stepper label={f.name} value={cart[f.id]} max={Math.min(20, f.left ?? 20)} onChange={(v) => setCart({ ...cart, [f.id]: v })} />
                        : <Button size="sm" icon="plus" onClick={() => setCart({ ...cart, [f.id]: 1 })}>Add</Button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {count > 0 && (
        <div className="cart-bar">
          <div className="container cart-bar-in">
            <div><b>{naira(total)}</b><span>{count} {count === 1 ? 'item' : 'items'}</span></div>
            <Button onClick={() => setCheckout(true)}>Continue <Icon name="arrow" size={18} /></Button>
          </div>
        </div>
      )}

      {checkout && (
        <Checkout event={event} lines={lines} total={total} onClose={() => setCheckout(false)}
          onDone={(token) => {
            const all = recall('asoebi:orders', {});
            remember('asoebi:orders', { ...all, [code]: [...(all[code] || []), token] });
            navigate(`/o/${token}?new=1`);
          }} />
      )}
    </PublicShell>
  );
}

function Checkout({ event, lines, total, onClose, onDone }) {
  const saved = recall('asoebi:guest', {});
  const [f, setF] = useState({ name: saved.name || '', phone: saved.phone || '', side: '', note: '' });
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const fe = (k) => (err?.field === k ? err.message : null);

  const place = async () => {
    setBusy(true); setErr(null);
    try {
      const { token } = await api.post(`/api/e/${event.code}/orders`, { ...f, items: lines.map((l) => ({ fabric_id: l.id, qty: l.qty })) });
      remember('asoebi:guest', { name: f.name, phone: f.phone });
      onDone(token);
    } catch (x) { setErr(x); setBusy(false); }
  };

  return (
    <Sheet open onClose={onClose} title="Your order"
      footer={<Button block loading={busy} onClick={place}>Place order · {naira(total)}</Button>}>
      <ul className="summary">
        {lines.map((l) => <li key={l.id}><span className="dot" style={{ background: l.color }} /><span>{l.qty}× {l.name}</span><b>{naira(l.qty * l.price)}</b></li>)}
        <li className="summary-total"><span>Total</span><b>{naira(total)}</b></li>
      </ul>
      <div className="form">
        {err && !err.field && <div className="alert">{err.message}</div>}
        {fe('items') && <div className="alert">{fe('items')}</div>}
        <Field label="Your name" name="gname" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={fe('name')} />
        <Field label="Phone number" name="gphone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 123 4567" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} hint="Only the celebrant sees it." error={fe('phone')} />
        {event.sides.length > 0 && (
          <div className={`field ${fe('side') ? 'has-error' : ''}`}>
            <span className="label">Whose side are you on?</span>
            <div className="chips">
              {event.sides.map((s) => <button type="button" key={s} className={`chip ${f.side === s ? 'on' : ''}`} onClick={() => setF({ ...f, side: s })} aria-pressed={f.side === s}>{s}</button>)}
            </div>
            {fe('side') && <span className="err">{fe('side')}</span>}
          </div>
        )}
        <Field as="textarea" rows={2} label="Note for the celebrant (optional)" name="note" placeholder="e.g. Size 14, or 'one is for my mum'" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={200} />
        <p className="hint">Next, you'll see the bank details to pay into. Aso-ebi doesn't take any money.</p>
      </div>
    </Sheet>
  );
}
