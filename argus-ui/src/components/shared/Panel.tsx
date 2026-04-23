import type { ReactNode } from 'react';

// Shared "card" wrapper used across BuildView, WarzoneView, and the history views.
// Keeps the aesthetic consistent — bordered rectangle, small caps header with a
// leading ▸ accent, optional right-aligned meta tag. Content goes in `children`.
//
// Pass `fill` when the Panel needs to grow to take remaining height inside a
// flex-column parent (e.g. the chat thread, so the input stays pinned at the
// bottom and the messages scroll internally).
export function Panel({
  headLabel,
  headRight,
  children,
  fill,
}: {
  headLabel: string;
  headRight?: string;
  children: ReactNode;
  fill?: boolean;
}) {
  return (
    <section
      style={{
        border: '1px solid var(--rule)',
        background: 'var(--bg-2)',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        ...(fill ? { flex: 1, minHeight: 0 } : {}),
      }}
    >
      <div
        style={{
          padding: '12px 18px',
          borderBottom: '1px solid var(--rule)',
          fontSize: 10,
          letterSpacing: '0.16em',
          color: 'var(--ink-dimmer)',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ color: 'var(--accent)' }}>▸</span>
        {headLabel}
        {headRight && (
          <span
            style={{
              marginLeft: 'auto',
              color: 'var(--ink-dim)',
              letterSpacing: '0.08em',
            }}
          >
            {headRight}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

// Primary/secondary button shared across views. `primary` is the solid acid-lime
// CTA; default is outlined; `warn` is the destructive variant in orange.
export function ActionButton({
  children,
  onClick,
  primary,
  warn,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
  warn?: boolean;
  disabled?: boolean;
}) {
  const bg = disabled ? 'transparent' : primary ? 'var(--accent)' : 'transparent';
  const color = disabled
    ? 'var(--ink-dimmer)'
    : primary
      ? 'var(--accent-ink)'
      : warn
        ? 'var(--warn)'
        : 'var(--ink)';
  const border = disabled
    ? '1px solid var(--rule)'
    : primary
      ? '1px solid var(--accent)'
      : warn
        ? '1px solid var(--warn)'
        : '1px solid var(--rule)';
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        background: bg,
        color,
        border,
        padding: '10px 18px',
        fontSize: 12,
        fontWeight: primary ? 600 : 500,
        letterSpacing: '0.05em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s, color 0.15s, border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        if (primary) e.currentTarget.style.background = '#d9ff66';
        else {
          e.currentTarget.style.borderColor = warn ? 'var(--warn)' : 'var(--accent)';
          e.currentTarget.style.color = warn ? 'var(--warn)' : 'var(--accent)';
        }
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        if (primary) e.currentTarget.style.background = 'var(--accent)';
        else {
          e.currentTarget.style.borderColor = 'var(--rule)';
          e.currentTarget.style.color = warn ? 'var(--warn)' : 'var(--ink)';
        }
      }}
    >
      {children}
    </button>
  );
}
