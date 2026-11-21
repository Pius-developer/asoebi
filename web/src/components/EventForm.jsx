import { useState } from 'react';
import { Button, Field } from './ui.jsx';

const KINDS = [
  { key: 'wedding', label: 'Wedding', emoji: '💍' },
  { key: 'birthday', label: 'Birthday', emoji: '🎂' },
  { key: 'burial', label: 'Burial', emoji: '🕊️' },
  { key: 'other', label: 'Other', emoji: '🎉' },
];
const DEFAULT_SIDES = {
  wedding: ["Bride's side", "Groom's side", 'Friends'],
  birthday: ['Family', 'Friends', 'Colleagues'],
  burial: ['Family', 'Friends', 'Church / Community'],
  other: ['Family', 'Friends'],
};

/** Used to create an event (two steps) and to edit one (all at once). */
export default function EventForm({ initial, onSubmit, submitLabel = 'Save', steps = false, busy, error }) {
  const [f, setF] = useState(() => ({
    kind: 'wedding', title: '', event_date: '', venue: '', deadline: '',
    bank_name: '', account_name: '', account_number: '', collection: '', sides: DEFAULT_SIDES.wedding,
    ...initial,
  }));
  const [step, setStep] = useState(1);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const fe = (k) => (error?.field === k ? error.message : null);
  const stepOf = { kind: 1, title: 1, event_date: 1, venue: 1, deadline: 1, sides: 1 };

  // If PHP rejects a field from step 1 while we're on step 2, jump back to it.
  if (steps && error?.field && stepOf[error.field] === 1 && step === 2) setTimeout(() => setStep(1));

  const first = (
    <>
      <div className="field">
        <span className="label">What's the occasion?</span>
        <div className="chips">
          {KINDS.map((k) => (
            <button type="button" key={k.key} className={`chip ${f.kind === k.key ? 'on' : ''}`}
              onClick={() => setF({ ...f, kind: k.key, sides: initial?.sides && initial.kind === k.key ? initial.sides : DEFAULT_SIDES[k.key] })}>
              <span aria-hidden="true">{k.emoji}</span>{k.label}
            </button>
          ))}
        </div>
      </div>
      <Field label="Event name" name="title" value={f.title} onChange={set('title')} placeholder={f.kind === 'wedding' ? "Tolu & Femi's wedding" : f.kind === 'birthday' ? "Mummy's 60th birthday" : 'Celebration of life: Papa Ade'} error={fe('title')} maxLength={80} />
      <div className="grid-2">
        <Field label="Date" name="event_date" type="date" value={f.event_date} onChange={set('event_date')} error={fe('event_date')} />
        <Field label="Last day to order" name="deadline" type="date" value={f.deadline || ''} onChange={set('deadline')} hint="Optional. Gives the tailor time." error={fe('deadline')} />
      </div>
      <Field label="Venue" name="venue" value={f.venue || ''} onChange={set('venue')} placeholder="e.g. Lekki, Lagos" error={fe('venue')} />
      <div className="field">
        <span className="label">Guests choose a side</span>
        <div className="sides-edit">
          {f.sides.map((s, i) => (
            <input key={i} className="input" value={s} aria-label={`Side ${i + 1}`} maxLength={30}
              onChange={(e) => setF({ ...f, sides: f.sides.map((x, j) => (j === i ? e.target.value : x)) })} />
          ))}
        </div>
        <span className="hint">{fe('sides') || 'Shown as a friendly "Bride\'s side vs Groom\'s side" tally on your page.'}</span>
      </div>
    </>
  );

  const second = (
    <>
      <div className="note-box">Guests see these details after they order, so they know where to pay. Aso-ebi never touches the money.</div>
      <div className="grid-2">
        <Field label="Bank" name="bank_name" value={f.bank_name || ''} onChange={set('bank_name')} placeholder="e.g. GTBank" error={fe('bank_name')} />
        <Field label="Account number" name="account_number" inputMode="numeric" maxLength={10} value={f.account_number || ''} onChange={(e) => setF({ ...f, account_number: e.target.value.replace(/\D/g, '') })} error={fe('account_number')} />
      </div>
      <Field label="Account name" name="account_name" value={f.account_name || ''} onChange={set('account_name')} error={fe('account_name')} />
      <Field as="textarea" label="Where and when to collect the fabric" name="collection" value={f.collection || ''} onChange={set('collection')} placeholder="e.g. 12 Admiralty Way, Lekki. Saturdays, 10am to 4pm." rows={3} error={fe('collection')} />
    </>
  );

  const submit = (e) => {
    e.preventDefault();
    if (steps && step === 1) { setStep(2); return; }
    onSubmit({ ...f, sides: f.sides.map((s) => s.trim()).filter(Boolean) });
  };

  return (
    <form onSubmit={submit} className="form" noValidate>
      {error && !error.field && <div className="alert">{error.message}</div>}
      {steps && (
        <ol className="steps">
          <li className={step === 1 ? 'on' : 'done'}><span>1</span>The event</li>
          <li className={step === 2 ? 'on' : ''}><span>2</span>Payment and pickup</li>
        </ol>
      )}
      {(!steps || step === 1) && first}
      {!steps && <h3 className="form-sub">Payment and pickup</h3>}
      {(!steps || step === 2) && second}
      <div className="btn-row">
        {steps && step === 2 && <Button type="button" variant="ghost" onClick={() => setStep(1)}>Back</Button>}
        <Button type="submit" loading={busy} icon={steps && step === 1 ? null : 'check'}>{steps && step === 1 ? 'Continue' : submitLabel}</Button>
      </div>
    </form>
  );
}
