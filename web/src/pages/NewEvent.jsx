import { useState } from 'react';
import { api } from '../lib/api.js';
import { useRouter } from '../lib/router.jsx';
import { useApp } from '../lib/store.jsx';
import { AppShell } from '../components/Shell.jsx';
import EventForm from '../components/EventForm.jsx';

export default function NewEvent() {
  const { navigate } = useRouter();
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const create = async (data) => {
    setBusy(true); setError(null);
    try {
      const { code } = await api.post('/api/events', data);
      toast('Event created. Now add your fabrics.');
      navigate(`/events/${code}?tab=fabrics`);
    } catch (x) { setError(x); } finally { setBusy(false); }
  };

  return (
    <AppShell>
      <div className="narrow">
        <div className="page-head"><div><h1>New event</h1><p className="muted">You can change all of this later.</p></div></div>
        <div className="card"><EventForm steps onSubmit={create} submitLabel="Create event" busy={busy} error={error} /></div>
      </div>
    </AppShell>
  );
}
