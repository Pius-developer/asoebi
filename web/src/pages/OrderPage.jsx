import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Link } from '../lib/router.jsx';
import { useApp } from '../lib/store.jsx';
import { PublicShell } from '../components/Shell.jsx';
import Icon from '../components/Icon.jsx';
import { Button, Copy, PhotoPicker, Spinner } from '../components/ui.jsx';
import { longDate, naira, whatsapp } from '../lib/format.js';
import NotFound from './NotFound.jsx';

export default function OrderPage({ token }) {
  const { toast } = useApp();
  const [order, setOrder] = useState(null);
  const [err, setErr] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [busy, setBusy] = useState(false);
  const isNew = new URLSearchParams(window.location.search).get('new') === '1';

  useEffect(() => {
    api.get(`/api/o/${token}`).then((r) => setOrder(r.order)).catch(setErr);
  }, [token]);

  if (err?.status === 404) return <NotFound title="Order not found" message="Check that you opened the full link." />;
  if (err) return <PublicShell><div className="alert">{err.message}</div></PublicShell>;
  if (!order) return <PublicShell><Spinner /></PublicShell>;

  const e = order.event;
  const pageUrl = `${window.location.origin}/e/${e.code}`;
  const myLink = window.location.origin + window.location.pathname;
  const stepIndex = order.collected ? 3 : order.status === 'paid' ? 2 : order.status === 'claimed' ? 1 : 0;
  const steps = ['Ordered', 'You paid', 'Confirmed', 'Collected'];

  const sayPaid = async () => {
    setBusy(true);
    const d = new FormData();
    if (receipt) d.append('receipt', receipt);
    try {
      const r = await api.post(`/api/o/${token}/paid`, d);
      setOrder(r.order);
      toast('Thanks! The celebrant will confirm it soon.');
    } catch (x) { toast(x.message, 'bad'); } finally { setBusy(false); }
  };

  return (
    <PublicShell>
      <div className="order-page">
        {isNew && <div className="celebrate"><span aria-hidden="true">🎉</span> Order placed! Pay below to secure your fabric.</div>}

        <div className="op-head">
          <Link to={`/e/${e.code}`} className="back-link"><Icon name="back" size={16} />{e.title}</Link>
          <h1>{order.name.split(' ')[0]}'s aso-ebi</h1>
          <p className="muted">Order <b className="ref">{order.ref}</b> · {longDate(e.event_date)}</p>
        </div>

        <ol className="progress" aria-label="Order progress">
          {steps.map((s, i) => (
            <li key={s} className={i < stepIndex ? 'done' : i === stepIndex ? 'now' : ''}>
              <span>{i <= stepIndex ? <Icon name="check" size={14} /> : i + 1}</span>{s}
            </li>
          ))}
        </ol>

        <div className="op-grid">
          <div className="op-main">
            {['unpaid', 'rejected'].includes(order.status) && (
              <section className="pay-card">
                <h2>{order.status === 'rejected' ? 'Payment not received yet' : 'Pay to secure your fabric'}</h2>
                <p>{order.status === 'rejected' ? 'The celebrant hasn\'t seen your payment. Check it went through, then tell them again.' : 'Transfer the total to the account below, then tap "I\'ve paid".'}</p>
                <div className="pay-total"><span>Amount</span><b>{naira(order.total)}</b><Copy text={String(order.total)} label="Copy" variant="glass" /></div>
                {e.account_number ? (
                  <div className="bank">
                    <div><span>Bank</span><b>{e.bank_name || '—'}</b></div>
                    <div><span>Account number</span><b className="acct">{e.account_number}</b><Copy text={e.account_number} label="Copy" variant="glass" /></div>
                    <div><span>Account name</span><b>{e.account_name || '—'}</b></div>
                    <div><span>Narration</span><b>{order.ref}</b><Copy text={order.ref} label="Copy" variant="glass" /></div>
                  </div>
                ) : <p className="bank-missing">The celebrant hasn't added bank details yet. Ask them how to pay.</p>}
                <div className="pay-actions">
                  <PhotoPicker onFile={setReceipt} label="Add your receipt screenshot (optional)" />
                  <Button block variant="light" loading={busy} icon="check" onClick={sayPaid}>I've paid {naira(order.total)}</Button>
                </div>
              </section>
            )}
            {order.status === 'claimed' && (
              <section className="state-card state-wait">
                <span className="state-ic"><Icon name="receipt" size={22} /></span>
                <div><h2>Waiting for confirmation</h2><p>You told the celebrant you paid{order.has_receipt ? ' and sent your receipt' : ''}. They'll confirm once they see it.</p></div>
              </section>
            )}
            {order.status === 'paid' && (
              <section className={`state-card ${order.collected ? 'state-done' : 'state-ok'}`}>
                <span className="state-ic"><Icon name={order.collected ? 'bag' : 'check'} size={22} /></span>
                <div>
                  <h2>{order.collected ? 'You\'ve collected your fabric 💜' : 'Payment confirmed 💜'}</h2>
                  <p>{order.collected ? 'See you at the event! Send a picture to the celebrant when your outfit is ready.' : 'Your fabric is reserved.'}</p>
                  {!order.collected && e.collection && <div className="collect"><Icon name="pin" size={18} /><div><b>Where to collect</b><span>{e.collection}</span></div></div>}
                </div>
              </section>
            )}
            {order.status === 'cancelled' && (
              <section className="state-card"><div><h2>This order was cancelled</h2><p>Contact the celebrant if this is a mistake, or <Link to={`/e/${e.code}`}>order again</Link>.</p></div></section>
            )}

            <section className="card">
              <h2 className="h-sm">What you ordered</h2>
              <ul className="summary">
                {order.items.map((i) => (
                  <li key={i.fabric_id}>
                    {i.photo ? <img src={i.photo} alt="" className="thumb" /> : <span className="dot" style={{ background: i.color }} />}
                    <span>{i.qty}× {i.name}</span><b>{naira(i.qty * i.price)}</b>
                  </li>
                ))}
                <li className="summary-total"><span>Total</span><b>{naira(order.total)}</b></li>
              </ul>
              {order.note && <p className="muted small mt-12">Your note: “{order.note}”</p>}
            </section>
          </div>

          <aside className="op-side">
            <section className="card share-card">
              <img src={`/api/e/${e.code}/card.png`} alt={`We're wearing aso-ebi for ${e.title}`} />
              <h2 className="h-sm">Tell your people</h2>
              <p className="muted small">Bring your friends{order.side ? ` to ${order.side}` : ''}. More colours, more fun.</p>
              <a className="btn btn-wa btn-block" target="_blank" rel="noopener" href={whatsapp(`I'm wearing aso-ebi for ${e.title} 💜 Get yours here: ${pageUrl}`)}><Icon name="wa" size={18} />Share on WhatsApp</a>
            </section>
            <section className="card">
              <h2 className="h-sm">Save this page</h2>
              <p className="muted small">This private link shows your order and payment details. Don't share it.</p>
              <div className="mt-12"><Copy text={myLink} label="Copy my order link" block /></div>
            </section>
          </aside>
        </div>
      </div>
    </PublicShell>
  );
}
