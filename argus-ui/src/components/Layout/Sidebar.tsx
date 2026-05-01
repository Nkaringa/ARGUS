import { useState } from 'react';
import type { Section, BuildState, WarzoneState } from '../../types';
import { ResetSessionsModal } from './ResetSessionsModal';
import { ThemeToggle } from './ThemeToggle';

interface SidebarProps {
  current: Section;
  onNavigate: (section: Section) => void;
  buildState: BuildState;
  warzoneState: WarzoneState;
}

export function Sidebar({ current, onNavigate, buildState, warzoneState }: SidebarProps) {
  const [resetOpen, setResetOpen] = useState(false);

  const buildBusy = buildState !== 'idle' && buildState !== 'done';
  const warzoneBusy = warzoneState !== 'idle';

  return (
    <>
      <aside
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          width: 'var(--sidebar-width)',
          borderRight: '1px solid var(--rule)',
          background: 'var(--bg)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        {/* Head — brand wordmark. The status bar that previously carried the
            brand was removed; the sidebar head anchors product identity now.
            ΛЯGUS uses Greek lambda + Cyrillic Я for visual character;
            aria-label keeps the accessible name as plain "argus". */}
        <div
          style={{
            padding: '18px 18px 14px',
            borderBottom: '1px dashed var(--rule)',
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
          <span
            aria-label="argus"
            style={{
              fontFamily: 'var(--font-display)',
              color: 'var(--ink)',
              fontWeight: 500,
              fontSize: 26,
              letterSpacing: '-0.02em',
            }}
          >
            ΛЯGUS
          </span>
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

        {/* Footer — theme toggle + refresh auth. The stop-pipeline button moved
            to BuildView (between hero and pipeline strip) so users find it
            inline with the active stage they're already looking at. */}
        <div style={{ borderTop: '1px solid var(--rule)' }}>
          <ThemeToggle />
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
        </div>
      </aside>

      <ResetSessionsModal open={resetOpen} onClose={() => setResetOpen(false)} />
    </>
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
