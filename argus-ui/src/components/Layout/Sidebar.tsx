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
      className={clsx('uppercase', busy ? 'text-[#1c69d4]' : 'text-[#bbbbbb]')}
      style={{ fontSize: 12, fontWeight: 400, letterSpacing: '0.15em' }}
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
      className={clsx(
        'block w-full text-left uppercase transition-colors',
        'text-white hover:text-white'
      )}
      style={{
        fontSize: 18,
        fontWeight: 900,
        lineHeight: 1.3,
        padding: '14px 32px',
        borderLeft: active ? '2px solid #1c69d4' : '2px solid transparent',
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
      className={clsx(
        'block w-full text-left transition-colors',
        active ? 'text-white' : 'text-[#bbbbbb] hover:text-white'
      )}
      style={{
        fontSize: 16,
        fontWeight: 400,
        lineHeight: 1.15,
        padding: '10px 32px 10px 48px',
      }}
    >
      {label}
    </button>
  );
}

function GroupLabel({ children }: { children: string }) {
  return (
    <p
      className="uppercase text-[#bbbbbb]"
      style={{
        fontSize: 12,
        fontWeight: 400,
        letterSpacing: '0.15em',
        padding: '24px 32px 12px',
      }}
    >
      {children}
    </p>
  );
}

export function Sidebar({ current, onNavigate, buildState, warzoneState, onStop }: SidebarProps) {
  const [resetOpen, setResetOpen] = useState(false);

  const overallBusy =
    (buildState !== 'idle' && buildState !== 'done') || warzoneState !== 'idle';
  const activeState = warzoneState !== 'idle' ? warzoneState : buildState;

  return (
    <>
      <aside
        style={{ width: 'var(--sidebar-width)', background: '#262626' }}
        className="flex-shrink-0 flex flex-col h-full"
      >
        {/* Brand */}
        <div style={{ padding: '40px 32px 32px' }}>
          <div
            className="uppercase text-white"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 32,
              fontWeight: 300,
              letterSpacing: '0.1em',
              lineHeight: 1.3,
            }}
          >
            Argus
          </div>
          <div style={{ marginTop: 12 }}>
            <StatusBadge state={activeState} />
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto">
          <div>
            <GroupLabel>Chat</GroupLabel>
            <SubNavItem
              label="Gemini"
              section="chat-gemini"
              current={current}
              onClick={() => onNavigate('chat-gemini')}
            />
            <SubNavItem
              label="Claude"
              section="chat-claude"
              current={current}
              onClick={() => onNavigate('chat-claude')}
            />
            <SubNavItem
              label="Codex"
              section="chat-codex"
              current={current}
              onClick={() => onNavigate('chat-codex')}
            />
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '16px 0' }} />

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

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '16px 0' }} />

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
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={() => setResetOpen(true)}
            className="block w-full text-left uppercase text-[#bbbbbb] hover:text-white transition-colors"
            style={{
              fontSize: 14,
              fontWeight: 400,
              letterSpacing: '0.15em',
              padding: '16px 32px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            Reset Sessions
          </button>

          {overallBusy && (
            <button
              onClick={onStop}
              className="block w-full text-left uppercase text-white transition-colors"
              style={{
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '0.15em',
                padding: '16px 32px',
              }}
            >
              Stop →
            </button>
          )}
        </div>
      </aside>

      <ResetSessionsModal open={resetOpen} onClose={() => setResetOpen(false)} />
    </>
  );
}
