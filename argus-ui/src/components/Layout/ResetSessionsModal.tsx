import { useEffect } from 'react';

interface ResetSessionsModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Documentation-only modal. No fetch, no backend call, no state mutation.
 *
 * Argus spawns each agent CLI fresh on every task — there are no session UUIDs
 * to manage. If a CLI's vendor auth (Claude Code login, Gemini CLI login, Codex
 * CLI login) expires, the user just re-authenticates that CLI in a terminal
 * and Argus picks up the refreshed auth on the next invocation.
 */
export function ResetSessionsModal({ open, onClose }: ResetSessionsModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.8)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white text-[#262626]"
        style={{ width: 640, padding: 48 }}
      >
        <div className="flex items-start justify-between mb-6">
          <h2
            className="uppercase"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 300,
              fontSize: 48,
              lineHeight: 1.3,
              letterSpacing: '0.02em',
            }}
          >
            Refresh Agent Auth
          </h2>
          <button
            onClick={onClose}
            className="uppercase text-[14px] text-[#262626] hover:text-[#1c69d4] transition-colors"
            style={{
              fontWeight: 400,
              letterSpacing: '0.15em',
              borderBottom: '1px solid currentColor',
              paddingBottom: 2,
            }}
          >
            Close
          </button>
        </div>

        <p
          className="text-[#262626]"
          style={{ fontSize: 16, lineHeight: 1.3, fontWeight: 400 }}
        >
          Argus spawns each agent CLI fresh on every task — no session state
          to manage, nothing to rotate. If an agent starts failing with an
          auth/login error, re-authenticate the CLI directly in your terminal.
          Argus picks up the refreshed auth on the next invocation with no
          restart needed.
        </p>

        <h3
          className="uppercase mt-10 mb-4"
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 900,
            fontSize: 18,
            letterSpacing: '0.15em',
          }}
        >
          Re-authenticate a CLI
        </h3>

        <div className="space-y-4">
          <CodeBlock
            label="Claude"
            lines={[
              'claude',
              '# follow the login prompt if auth has expired',
              '# /exit once you see the prompt',
            ]}
          />
          <CodeBlock
            label="Gemini"
            lines={[
              'gemini',
              '# follow the login prompt if auth has expired',
              '# /exit once you see the prompt',
            ]}
          />
          <CodeBlock
            label="Codex"
            lines={[
              'codex',
              '# follow the login prompt if auth has expired',
              '# exit once you see the prompt',
            ]}
          />
        </div>

        <p
          className="mt-8"
          style={{ fontSize: 14, lineHeight: 1.3, color: '#757575' }}
        >
          Each CLI caches its auth locally. Argus reads that cache every time
          it spawns the CLI, so there is no per-agent config inside Argus to
          touch — no <code className="bg-[#262626] text-white px-1.5 py-0.5">.env</code> edit, no Hermes restart.
        </p>
      </div>
    </div>
  );
}

function CodeBlock({ label, lines }: { label: string; lines: string[] }) {
  return (
    <div>
      {label && (
        <p
          className="uppercase mb-2"
          style={{
            color: '#757575',
            fontSize: 14,
            fontWeight: 400,
            letterSpacing: '0.15em',
          }}
        >
          {label}
        </p>
      )}
      <pre
        className="bg-[#262626] text-white whitespace-pre-wrap"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          lineHeight: 1.3,
          padding: '16px 24px',
          margin: 0,
        }}
      >
        {lines.join('\n')}
      </pre>
    </div>
  );
}
