import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { initials } from '../lib/format.js';

export function Logo({ small = false }) {
  return (
    <span className={`logo ${small ? 'logo-sm' : ''}`}>
      <svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="#7C3AED" /><circle cx="12.5" cy="16" r="6.5" fill="#C4B5FD" /><circle cx="19.5" cy="16" r="6.5" fill="#fff" fillOpacity=".9" /></svg>
      <span>Aso-ebi</span>
    </span>
  );
}

export function Button({ variant = 'primary', size, block, loading, icon, children, className = '', ...props }) {
  return (
    <button className={`btn btn-${variant} ${size ? 'btn-' + size : ''} ${block ? 'btn-block' : ''} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading ? <span className="spin" aria-hidden="true" /> : icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
    </button>
  );
}

/** Text input with label, hint and error. Pass `error` when PHP says this field is wrong. */
export function Field({ label, hint, error, prefix, as = 'input', children, ...props }) {
  const Tag = as;
  const id = props.id || props.name;
  return (
    <div className={`field ${error ? 'has-error' : ''}`}>
      {label && <label htmlFor={id}>{label}</label>}
      {children || (
        <div className={prefix ? 'with-prefix' : undefined}>
          {prefix && <span className="prefix">{prefix}</span>}
          <Tag id={id} className="input" aria-invalid={!!error} {...props} />
        </div>
      )}
      {error ? <span className="err">{error}</span> : hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Pill({ tone = 'muted', children }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function Avatar({ name, size = 40 }) {
  const hue = [262, 290, 320, 200, 160, 30][[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 6];
  return <span className="avatar" style={{ '--h': hue, width: size, height: size, fontSize: size * 0.36 }}>{initials(name)}</span>;
}

/** Overlapping colour circles, like folded fabric. */
export function Swatches({ colors, size = 28 }) {
  return (
    <span className="swatches" style={{ '--s': size + 'px' }} aria-hidden="true">
      {colors.slice(0, 5).map((c, i) => <i key={i} style={{ background: c }} />)}
    </span>
  );
}

export function Copy({ text, label = 'Copy', block, variant = 'soft', size = 'sm' }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1600); }
    catch { window.prompt('Copy this:', text); }
  };
  return <Button type="button" variant={variant} size={size} block={block} icon={done ? 'check' : 'copy'} onClick={copy}>{done ? 'Copied' : label}</Button>;
}

/** Bottom sheet on phones, centred dialog on bigger screens. Closes with Escape or the backdrop. */
export function Sheet({ open, onClose, title, children, footer }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    ref.current?.querySelector('input, select, textarea, button')?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('no-scroll'); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Stepper({ value, onChange, max = 20, label }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} disabled={value === 0} aria-label={`Fewer ${label}`}><Icon name="minus" size={16} /></button>
      <span aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More ${label}`}><Icon name="plus" size={16} /></button>
    </div>
  );
}

export function Spinner({ label = 'Loading' }) {
  return <div className="loading"><span className="spin" /> {label}…</div>;
}

export function Empty({ icon = 'spark', title, children, action }) {
  return (
    <div className="empty">
      <span className="empty-ic"><Icon name={icon} size={24} /></span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/** Image picker with preview. Calls onFile(File). */
export function PhotoPicker({ current, onFile, label = 'Add a photo', error, round }) {
  const [preview, setPreview] = useState(current);
  useEffect(() => setPreview(current), [current]);
  return (
    <label className={`photo-pick ${round ? 'round' : ''} ${error ? 'has-error' : ''}`}>
      <input type="file" accept="image/*" onChange={(e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setPreview(URL.createObjectURL(f));
        onFile(f);
      }} />
      {preview ? <img src={preview} alt="" /> : <span className="photo-empty"><Icon name="upload" size={22} />{label}</span>}
      {preview && <span className="photo-change">Change</span>}
    </label>
  );
}
