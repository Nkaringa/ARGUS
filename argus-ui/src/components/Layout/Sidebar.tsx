import { useState } from 'react';
import { clsx } from 'clsx';
import type { Section, BuildState, WarzoneState } from '../../types';
import { ResetSessionsModal } from './ResetSessionsModal';

interface SidebarProps {
  current: Section;
  onNavigate: (section: Section) => void;
  buildState: BuildState;
  warzoneState: WarzoneState;
  onStop: () => void;
}

function StatusBadge({ state }: { state: BuildState | WarzoneState }) {
  const busy = state !== 'idle' && state !== 'done';
  const label = busy ? state.toUpperCase().replace(/_/g, ' ') : 'IDLE';
  return (
    <span
      className={clsx('uppercase')}
      style={{
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.15em',
        fontFamily: 'var(--font-mono)',
        color: busy ? 'var(--color-accent)' : 'var(--color-fg-2)',
      }}
    >
      {label}
    </span>
  );
}

function NavItem({
  label,
  section,
  current,
  onClick,
}: {
  label: string;
  section: Section;
  current: Section;
  onClick: () => void;
}) {
  const active = current === section;
  return (
    <button
      onClick={onClick}
      className="block w-full text-left uppercase transition-colors"
      style={{
        fontSize: 15,
        fontWeight: 600,
        lineHeight: 1.3,
        letterSpacing: '0.06em',
        padding: '12px 32px',
        color: active ? 'var(--color-fg-0)' : 'var(--color-fg-1)',
        borderLeft: active
          ? '2px solid var(--color-accent)'
          : '2px solid transparent',
        background: 'transparent',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.color = 'var(--color-fg-0)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.color = 'var(--color-fg-1)';
      }}
    >
      {label}
    </button>
  );
}

function SubNavItem({
  label,
  section,
  current,
  onClick,
}: {
  label: string;
  section: Section;
  current: Section;
  onClick: () => void;
}) {
  const active = current === section;
  return (
    <button
      onClick={onClick}
      className="block w-full text-left transition-colors"
      style={{
        fontSize: 14,
        fontWeight: 400,
        lineHeight: 1.3,
        fontFamily: 'var(--font-mono)',
        padding: '8px 32px 8px 48px',
        color: active ? 'var(--color-accent)' : 'var(--color-fg-1)',
        background: 'transparent',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.color = 'var(--color-fg-0)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.color = 'var(--color-fg-1)';
      }}
    >
      [{label}]
    </button>
  );
}

function GroupLabel({ children }: { children: string }) {
  return (
    <p
      className="uppercase"
      style={{
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.15em',
        color: 'var(--color-fg-2)',
        fontFamily: 'var(--font-mono)',
        padding: '24px 32px 10px',
        margin: 0,
      }}
    >
      {children}
    </p>
  );
}

export function Sidebar({
  current,
  onNavigate,
  buildState,
  warzoneState,
  onStop,
}: SidebarProps) {
  const [resetOpen, setResetOpen] = useState(false);

  const overallBusy =
    (buildState !== 'idle' && buildState !== 'done') || warzoneState !== 'idle';
  const activeState = warzoneState !== 'idle' ? warzoneState : buildState;

  return (
    <>
      <aside
        style={{
          width: 'var(--sidebar-width)',
          background: 'var(--color-ink-1)',
          borderRight: '1px solid var(--color-ink-3)',
        }}
        className="flex-shrink-0 flex flex-col h-full"
      >
        {/* Brand */}
        <div style={{ padding: '32px 32px 28px' }}>
          <div
            className="uppercase"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '0.22em',
              lineHeight: 1.1,
              color: 'var(--color-fg-0)',
            }}
          >
            Argus
          </div>
          <div style={{ marginTop: 10 }}>
            <StatusBadge state={activeState} />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto">
          <div>
            <GroupLabel>Chat</GroupLabel>
            <SubNavItem
              label="gemini"
              section="chat-gemini"
              current={current}
              onClick={() => onNavigate('chat-gemini')}
            />
            <SubNavItem
              label="claude"
              section="chat-claude"
              current={current}
              onClick={() => onNavigate('chat-claude')}
            />
            <SubNavItem
              label="codex"
              section="chat-codex"
              current={current}
              onClick={() => onNavigate('chat-codex')}
            />
          </div>

          <div
            style={{
              borderTop: '1px solid var(--color-ink-3)',
              margin: '16px 0',
            }}
          />

          <div>
            <GroupLabel>Work</GroupLabel>
            <NavItem
              label="Build"
              section="build"
              current={current}
              onClick={() => onNavigate('build')}
            />
            <NavItem
              label="Warzone"
              section="warzone"
              current={current}
              onClick={() => onNavigate('warzone')}
            />
          </div>

          <div
            style={{
              borderTop: '1px solid var(--color-ink-3)',
              margin: '16px 0',
            }}
          />

          <div>
            <GroupLabel>History</GroupLabel>
            <NavItem
              label="Logs"
              section="logs"
              current={current}
              onClick={() => onNavigate('logs')}
            />
          </div>
        </nav>

        {/* Bottom controls */}
        <div style={{ borderTop: '1px solid var(--color-ink-3)' }}>
          <button
            onClick={() => setResetOpen(true)}
            className="block w-full text-left uppercase transition-colors"
            style={{
              fontSize: 12,
              fontWeight: 400,
              letterSpacing: '0.15em',
              fontFamily: 'var(--font-mono)',
              padding: '14px 32px',
              color: 'var(--color-fg-1)',
              background: 'transparent',
              borderBottom: '1px solid var(--color-ink-3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-fg-1)';
            }}
          >
            Reset Sessions
          </button>

          {overallBusy && (
            <button
              onClick={onStop}
              className="block w-full text-left uppercase transition-colors"
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.15em',
                fontFamily: 'var(--font-mono)',
                padding: '14px 32px',
                color: 'var(--color-danger)',
                background: 'transparent',
              }}
            >
              Stop ×
            </button>
          )}
        </div>
      </aside>

      <ResetSessionsModal open={resetOpen} onClose={() => setResetOpen(false)} />
    </>
  );
}
