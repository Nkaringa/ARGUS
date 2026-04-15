import { useEffect } from 'react';

interface ResetSessionsModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Documentation-only modal. No fetch, no backend call, no state mutation.
 * Argus never creates agent sessions — rotation is a manual .env edit.
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
            Reset Sessions
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
          Argus never creates agent sessions. All three bots are invoked with
          {' '}<code className="bg-[#262626] text-white px-1.5 py-0.5">--resume &lt;UUID&gt;</code>{' '}
          from values in <code className="bg-[#262626] text-white px-1.5 py-0.5">hermes/.env</code>.
          To rotate context, seed fresh UUIDs and restart Hermes — Argus has no
          server-side session state to clear.
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
          Rotation Steps
        </h3>

        <div className="space-y-4">
          <CodeBlock
            label="Claude"
            lines={[
              'cd $WORK_DIR && claude',
              '# send one message, then /exit cleanly',
              '# copy the UUID from the resume hint',
              '# paste into hermes/.env as CLAUDE_SESSION_ID',
            ]}
          />
          <CodeBlock
            label="Gemini"
            lines={[
              'cd $WORK_DIR && gemini',
              '# send one message, then /exit',
              '# copy UUID, paste as GEMINI_SESSION_ID',
            ]}
          />
          <CodeBlock
            label="Codex"
            lines={[
              'cd $WORK_DIR && codex',
              '# send one message, then /exit',
              '# copy UUID, paste as CODEX_SESSION_ID',
            ]}
          />
        </div>

        <h3
          className="uppercase mt-10 mb-4"
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 900,
            fontSize: 18,
            letterSpacing: '0.15em',
          }}
        >
          Restart Hermes
        </h3>
        <CodeBlock label="" lines={['npm run dev']} />
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
