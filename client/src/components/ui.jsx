export function Table({ children, className }) {
  return <div className={`table ${className || ''}`}>{children}</div>;
}

export function TableRow({ children, className }) {
  return <div className={`table-row ${className || ''}`}>{children}</div>;
}

export function TableCell({ children, className, style }) {
  return <div className={`table-cell ${className || ''}`} style={style}>{children}</div>;
}

export function TableHeader({ children, className, style }) {
  return <div className={`table-header ${className || ''}`} style={style}>{children}</div>;
}

export function Avatar({ user, size = 40 }) {
  const name = user?.name || '?';
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        background: user?.color || '#4f6df5',
        fontSize: size * 0.38,
      }}
      title={name}
    >
      {initials}
    </span>
  );
}

export function Badge({ children, tone = 'neutral' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Stars({ value = 0, count, size = 14, onChange, readOnly = false }) {
  const rounded = Math.round(value);
  return (
    <span className="stars" style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={i <= rounded ? 'star on' : 'star'}
          style={onChange && !readOnly ? { cursor: 'pointer' } : undefined}
          onClick={onChange && !readOnly ? () => onChange(i) : undefined}
        >
          ★
        </span>
      ))}
      <span className="star-count">
        {typeof value === 'number' ? value.toFixed(1) : '0.0'}
        {count != null ? ` (${count})` : ''}
      </span>
    </span>
  );
}

export function StatCard({ label, value, sub, tone = 'blue', onClick }) {
  return (
    <div className={`stat-card stat-${tone} ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">◎</div>
      <h4>{title}</h4>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}

export function Spinner() {
  return <div className="spinner" />;
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  const tones = {
    pending: 'amber',
    accepted: 'green',
    completed: 'blue',
    declined: 'red',
    cancelled: 'red',
    not_started: 'neutral',
    in_progress: 'amber',
  };
  const labels = {
    not_started: 'Not started',
    in_progress: 'In progress',
    in_person: 'In person',
  };
  return <Badge tone={tones[status] || 'neutral'}>{labels[status] || status?.replace('_', ' ')}</Badge>;
}

export function formatDate(value, opts = {}) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...opts,
  });
}

export function mentorTypeLabel(type) {
  return { faculty: 'Faculty Mentor', alumni: 'Alumni Mentor', industry: 'Industry Mentor' }[type] || type;
}

export function mentorTypeTone(type) {
  return { faculty: 'blue', alumni: 'green', industry: 'purple' }[type] || 'neutral';
}

export function Card({ children, className, title }) {
  const defaultClassName = "card";
  return (
    <div className={`${defaultClassName} ${className || ''}`}>
      {title && <div className="card-header">{title}</div>}
      <div className="card-body">{children}</div>
    </div>
  );
}

const BUTTON_MODS = [
  'button-small', 'button-primary', 'button-secondary', 'button-danger',
  'button-info', 'button-success', 'w-100', 'w-full', 'mr-2', 'mt-2',
  'mt-3', 'respond-btn',
];

export function Button({ children, className = '', ...rest }) {
  const mods = [];
  const props = {};
  Object.entries(rest).forEach(([k, v]) => {
    if (BUTTON_MODS.includes(k)) {
      if (v) mods.push(k);
    } else {
      props[k] = v;
    }
  });
  return (
    <button className={`button ${mods.join(' ')} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

export function Progress({ percent = 0 }) {
  const safe = Number.isFinite(percent) ? Math.max(0, Math.min(100, Math.round(percent))) : 0;
  return (
    <div className="progress">
      <div className="progress-fill" style={{ width: `${safe}%` }} />
      <span className="progress-text">{safe}%</span>
    </div>
  );
}

export function StatButton({ value, onClick, tone = 'neutral' }) {
  return (
    <button className={`stat-button stat-${tone}`} onClick={onClick}>
      {value}
    </button>
  );
}

export function FormGroup({ label, children }) {
  return (
    <div className="form-group">
      {label && <label>{label}</label>}
      <div className="form-control">{children}</div>
    </div>
  );
}

export function Input({ label, className = '', ...props }) {
  return (
    <div className="input-wrap">
      {label && <label className="input-label">{label}</label>}
      <input className={`input ${className}`.trim()} {...props} />
    </div>
  );
}

export function Select({ label, options, children, className = '', ...props }) {
  return (
    <div className="input-wrap">
      {label && <label className="input-label">{label}</label>}
      <select className={`input ${className}`.trim()} {...props}>
        {options
          ? options.map((o) => (
              <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>
                {typeof o === 'string' ? o : o.label}
              </option>
            ))
          : children}
      </select>
    </div>
  );
}

export function Textarea({ label, className = '', ...props }) {
  return (
    <div className="input-wrap">
      {label && <label className="input-label">{label}</label>}
      <textarea className={`textarea ${className}`.trim()} {...props} />
    </div>
  );
}