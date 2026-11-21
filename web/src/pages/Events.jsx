import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Link } from '../lib/router.jsx';
import { AppShell } from '../components/Shell.jsx';
import { Empty, Pill, Spinner } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { daysUntil, naira, niceDate } from '../lib/format.js';
import { useApp } from '../lib/store.jsx';

export default function Events() {
  const { user } = useApp();
  const [events, setEvents] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.get('/api/events').then((r) => setEvents(r.events)).catch(setErr);
  }, []);

  return (
    <AppShell>
      <div className="page-head">
        <div>
          <p className="eyebrow-plain">Hi {user?.name.split(' ')[0]} 👋</p>
          <h1>Your events</h1>
        </div>
        <Link to="/events/new" className="btn btn-primary hide-sm"><Icon name="plus" size={18} />New event</Link>
      </div>

      {err && <div className="alert">{err.message}</div>}
      {!events && !err && <Spinner />}
      {events && events.length === 0 && (
        <Empty icon="fabric" title="No events yet" action={<Link to="/events/new" className="btn btn-primary"><Icon name="plus" size={18} />Create your first event</Link>}>
          Set up your aso-ebi in two minutes: add your fabrics and share one link with your guests.
        </Empty>
      )}
      {events && events.length > 0 && (
        <div className="event-grid">
          {events.map((e) => {
            const d = daysUntil(e.event_date);
            const pct = e.stats.expected ? Math.round((e.stats.raised / e.stats.expected) * 100) : 0;
            return (
              <Link key={e.code} to={`/events/${e.code}`} className="event-card">
                <div className="event-card-cover" style={e.cover ? { backgroundImage: `url(${e.cover})` } : undefined}>
                  {!e.cover && <Icon name="fabric" size={36} />}
                  <Pill tone={d < 0 ? 'muted' : e.status === 'open' ? 'ok' : 'warn'}>{d < 0 ? 'Done' : e.status === 'open' ? 'Taking orders' : 'Orders closed'}</Pill>
                </div>
                <div className="event-card-body">
                  <h3>{e.title}</h3>
                  <p className="muted small"><Icon name="calendar" size={15} /> {niceDate(e.event_date)}{d >= 0 && ` · ${d === 0 ? 'today' : d + ' days to go'}`}</p>
                  <div className="event-card-nums">
                    <div><b>{naira(e.stats.raised)}</b><span>confirmed</span></div>
                    <div><b>{e.stats.orders}</b><span>orders</span></div>
                    {e.stats.to_confirm > 0 && <div className="attn"><b>{e.stats.to_confirm}</b><span>to confirm</span></div>}
                  </div>
                  <div className="bar"><i style={{ width: pct + '%' }} /></div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
