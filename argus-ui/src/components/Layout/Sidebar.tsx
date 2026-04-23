import { useState } from 'react';
import type { Section, BuildState, WarzoneState } from '../../types';
import { ResetSessionsModal } from './ResetSessionsModal';

interface SidebarProps {
  current: Section;
  onNavigate: (section: Section) => void;
  buildState: BuildState;
  warzoneState: WarzoneState;
  onStop: () => void;
}

// Human-readable state label for the sidebar header pill.
// Examples: 'discussing_gemini' → 'DISCUSSING · GEMINI', 'awaiting_approval' → 'AWAITING · APPROVAL'.
function formatState(s: BuildState | WarzoneState): string {
  if (s === 'idle') return 'IDLE';
  return s.toUpperCase().replace(/_/g, ' · ');
}

export function Sidebar({ current, onNavigate, buildState, warzoneState, onStop }: SidebarProps) {
  const [resetOpen, setResetOpen] = useState(false);

  const buildBusy = buildState !== 'idle' && buildState !== 'done';
  const warzoneBusy = warzoneState !== 'idle';
  const overallBusy = buildBusy || warzoneBusy;
  // Warzone state wins the pill when active, otherwise Build state — roughly matches
  // "what is the user most likely paying attention to right now."
  const activeState: BuildState | WarzoneState = warzoneBusy ? warzoneState : buildState;

  return (
    <>
      <aside
        style={{
          position: 'sticky',
          top: 'var(--statusbar-height)',
          height: 'calc(100vh - var(--statusbar-height))',
          width: 'var(--sidebar-width)',
          borderRight: '1px solid var(--rule)',
          background: 'var(--bg)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        {/* Head — state pill only; brand lives in the status bar */}
        <div
          style={{
            padding: '18px 18px 14px',
            borderBottom: '1px dashed var(--rule)',
          }}
        >
          <StatePill state={activeState} busy={overallBusy} />
        </div>

        {/* Nav — three grouped sections */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 0 20px' }}>
          <GroupLabel>chat</GroupLabel>
          <SubItem
            agentClass="claude"
            label="claude"
            role="planner"
            section="chat-claude"
            current={current}
            onClick={() => onNavigate('chat-claude')}
          />
          <SubItem
            agentClass="gemini"
            label="gemini"
            role="builder"
            section="chat-gemini"
            current={current}
            onClick={() => onNavigate('chat-gemini')}
          />
          <SubItem
            agentClass="codex"
            label="codex"
            role="auditor"
            section="chat-codex"
            current={current}
            onClick={() => onNavigate('chat-codex')}
          />

          <GroupLabel>work</GroupLabel>
          <Item
            index="01"
            label="build"
            section="build"
            current={current}
            marker={buildBusy ? '●' : '—'}
            markerLive={buildBusy}
            onClick={() => onNavigate('build')}
          />
          <Item
            index="02"
            label="warzone"
            section="warzone"
            current={current}
            marker={warzoneBusy ? '●' : '—'}
            markerLive={warzoneBusy}
            onClick={() => onNavigate('warzone')}
          />

          <GroupLabel>history</GroupLabel>
          <Item
            index="03"
            label="logs"
            section="logs"
            current={current}
            marker="—"
            onClick={() => onNavigate('logs')}
          />
          <Item
            index="04"
            label="archive"
            section="archive"
            current={current}
            marker="—"
            onClick={() => onNavigate('archive')}
          />
        </nav>

        {/* Footer — refresh auth, stop pipeline (only when something is running) */}
        <div style={{ borderTop: '1px solid var(--rule)' }}>
          <button
            onClick={() => setResetOpen(true)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '12px 18px',
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--ink-dim)',
              cursor: 'pointer',
              borderBottom: '1px solid var(--rule)',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-dim)')}
          >
            <span style={{ color: 'var(--ink-dimmer)' }}>↻ </span>
            refresh agent auth
          </button>

          {overallBusy && (
            <button
              onClick={onStop}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '12px 18px',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--accent-ink)',
                background: 'var(--accent)',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#d9ff66')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent)')}
            >
              ■ stop pipeline
            </button>
          )}
        </div>
      </aside>

      <ResetSessionsModal open={resetOpen} onClose={() => setResetOpen(false)} />
    </>
  );
}

function StatePill({ state, busy }: { state: BuildState | WarzoneState; busy: boolean }) {
  if (!busy) {
    return (
      <span
        style={{
          marginTop: 10,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 10,
          letterSpacing: '0.14em',
          color: 'var(--ink-dimmer)',
          padding: '4px 8px',
          border: '1px solid var(--rule-hot)',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            background: 'var(--ink-dimmer)',
            borderRadius: '50%',
          }}
        />
        IDLE
      </span>
    );
  }
  return (
    <span
      style={{
        marginTop: 10,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 10,
        letterSpacing: '0.14em',
        color: 'var(--accent)',
        padding: '4px 8px',
        border: '1px solid var(--accent)',
        background: 'rgba(196,255,61,0.08)',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          background: 'var(--accent)',
          borderRadius: '50%',
          animation: 'pulse 1.6s ease-in-out infinite',
        }}
      />
      {formatState(state)}
    </span>
  );
}

function GroupLabel({ children }: { children: string }) {
  return (
    <div
      style={{
        padding: '14px 18px 6px',
        fontSize: 10,
        letterSpacing: '0.16em',
        color: 'var(--ink-dimmer)',
        textTransform: 'uppercase',
        display: 'flex',
        alignItems: 'baseline',
        gap: 6,
      }}
    >
      <span style={{ color: 'var(--rule-hot)' }}>//</span>
      {children}
    </div>
  );
}

function Item({
  index,
  label,
  section,
  current,
  marker,
  markerLive,
  onClick,
}: {
  index: string;
  label: string;
  section: Section;
  current: Section;
  marker: string;
  markerLive?: boolean;
  onClick: () => void;
}) {
  const active = current === section;
  return (
    <button
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '20px 1fr auto',
        gap: 10,
        alignItems: 'center',
        width: '100%',
        textAlign: 'left',
        padding: '8px 18px',
        fontSize: 13,
        color: active ? 'var(--ink)' : 'var(--ink-dim)',
        cursor: 'pointer',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
        background: active ? 'var(--bg-2)' : 'transparent',
        transition: 'color 0.15s, background 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = 'var(--ink)';
          e.currentTarget.style.background = 'var(--bg-2)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = 'var(--ink-dim)';
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      <span style={{ color: active ? 'var(--accent)' : 'var(--ink-dimmer)', fontSize: 10 }}>
        {index}
      </span>
      <span>{label}</span>
      <span
        style={{
          color: markerLive ? 'var(--accent)' : active ? 'var(--accent)' : 'var(--ink-dimmer)',
          fontSize: 10,
        }}
      >
        {marker}
      </span>
    </button>
  );
}

function SubItem({
  agentClass,
  label,
  role,
  section,
  current,
  onClick,
}: {
  agentClass: 'claude' | 'gemini' | 'codex';
  label: string;
  role: string;
  section: Section;
  current: Section;
  onClick: () => void;
}) {
  const active = current === section;
  const dotColor =
    agentClass === 'claude'
      ? 'var(--claude)'
      : agentClass === 'gemini'
        ? 'var(--gemini)'
        : 'var(--codex)';
  return (
    <button
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '20px 1fr auto',
        gap: 10,
        alignItems: 'center',
        width: '100%',
        textAlign: 'left',
        padding: '8px 18px 8px 34px',
        fontSize: 13,
        color: active ? 'var(--ink)' : 'var(--ink-dim)',
        cursor: 'pointer',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
        background: active ? 'var(--bg-2)' : 'transparent',
        transition: 'color 0.15s, background 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = 'var(--ink)';
          e.currentTarget.style.background = 'var(--bg-2)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = 'var(--ink-dim)';
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: dotColor,
          boxShadow: active ? `0 0 8px ${dotColor}` : 'none',
          display: 'inline-block',
          justifySelf: 'center',
        }}
      />
      <span>
        {label}{' '}
        <span
          style={{
            fontSize: 10,
            color: active ? 'var(--accent)' : 'var(--ink-dimmer)',
            letterSpacing: '0.08em',
          }}
        >
          {role}
        </span>
      </span>
      <span style={{ color: active ? 'var(--accent)' : 'var(--ink-dimmer)', fontSize: 10 }}>
        {active ? '●' : 'idle'}
      </span>
    </button>
  );
}
