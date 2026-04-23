import type { BuildState, WarzoneState } from '../../types';

interface StatusBarProps {
  buildState: BuildState;
  warzoneState: WarzoneState;
}

// Status bar is the persistent top chrome — brand, live-system ticker, quick nav,
// keyboard hint, and the hermes-live pill. Stays above every view.
export function StatusBar({ buildState, warzoneState }: StatusBarProps) {
  const overallLive = buildState !== 'idle' && buildState !== 'done';
  const pillLabel = overallLive ? 'hermes live' : warzoneState !== 'idle' ? 'warzone live' : 'hermes live';

  // Ticker content is intentionally a single long string — the marquee animation
  // scrolls it across the bar. Values are derived from what we actually expose in
  // the app; we avoid surfacing invented internals (no fake task_ids / versions).
  const tickerText =
    `ws :3001 :3002 :3003 connected · nats ok · sqlite WAL · ` +
    `build ${buildState} · warzone ${warzoneState} · ` +
    `role docs resumed · chokidar armed · awaitWriteFinish 1s`;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        display: 'grid',
        gridTemplateColumns: `var(--sidebar-width) 1fr auto auto auto`,
        gap: 20,
        alignItems: 'center',
        padding: '9px 20px',
        background: 'var(--bg)',
        borderBottom: '1px solid var(--rule)',
        zIndex: 100,
        height: 'var(--statusbar-height)',
        fontSize: 11,
        letterSpacing: '0.04em',
        color: 'var(--ink-dim)',
      }}
    >
      {/* Brand — single source of truth, sized to anchor the whole app.
          Visually stylized as ΛЯGUS (Greek lambda for A, Cyrillic Я for R);
          aria-label keeps the accessible name as plain "argus". */}
      <div
        style={{
          fontFamily: 'var(--font-display)',
          color: 'var(--ink)',
          fontWeight: 500,
          fontSize: 26,
          letterSpacing: '-0.02em',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span
          style={{
            color: 'var(--accent)',
            fontSize: 14,
            animation: 'blink 1.4s steps(1) infinite',
          }}
        >
          ◉
        </span>
        <span aria-label="argus">ΛЯGUS</span>
      </div>

      {/* Ticker — system heartbeat scrolling across the center */}
      <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <span
          style={{
            display: 'inline-block',
            paddingLeft: '100%',
            animation: 'ticker 44s linear infinite',
          }}
        >
          {tickerText}
        </span>
      </div>

      {/* Quick nav — decorative for now, real sidebar is the source of truth */}
      <nav style={{ display: 'flex', gap: 18 }}>
        <NavLink label="dashboard" />
        <NavLink label="logs" />
        <NavLink label="archive" />
      </nav>

      {/* Keyboard hint */}
      <span
        style={{
          padding: '2px 6px',
          border: '1px solid var(--rule)',
          fontSize: 10,
          color: 'var(--ink-dim)',
        }}
      >
        ⌘K
      </span>

      {/* Live pill */}
      <span
        style={{
          padding: '3px 10px',
          border: '1px solid var(--rule)',
          color: 'var(--ink)',
          fontSize: 10,
          letterSpacing: '0.1em',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            background: 'var(--accent)',
            borderRadius: '50%',
            boxShadow: '0 0 8px var(--accent)',
            animation: 'pulse 1.8s ease-in-out infinite',
          }}
        />
        {pillLabel}
      </span>
    </div>
  );
}

function NavLink({ label }: { label: string }) {
  return (
    <a
      style={{
        color: 'var(--ink-dim)',
        transition: 'color 0.15s',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-dim)')}
    >
      <span style={{ color: 'var(--ink-dimmer)', marginRight: 2 }}>./</span>
      {label}
    </a>
  );
}
