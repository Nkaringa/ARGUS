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
      style={{ background: 'rgba(0,0,0,0.78)' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-ink-1)',
          border: '1px solid var(--color-ink-3)',
          color: 'var(--color-fg-0)',
          width: 640,
          padding: 40,
        }}
      >
        <div className="flex items-start justify-between" style={{ marginBottom: 28 }}>
          <h2
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 28,
              fontWeight: 500,
              lineHeight: 1.2,
              letterSpacing: '-0.01em',
              margin: 0,
              color: 'var(--color-fg-0)',
            }}
          >
            Reset sessions
          </h2>
          <button
            onClick={onClose}
            className="uppercase transition-colors"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              fontWeight: 400,
              letterSpacing: '0.15em',
              color: 'var(--color-fg-1)',
              background: 'transparent',
              border: 'none',
              padding: '4px 0',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-fg-1)')}
          >
            [close]
          </button>
        </div>

        <p
          style={{
            fontSize: 15,
            lineHeight: 1.55,
            fontWeight: 400,
            color: 'var(--color-fg-1)',
            margin: 0,
          }}
        >
          Argus never creates agent sessions. All three bots are invoked with{' '}
          <code className="inline-code">--resume &lt;UUID&gt;</code> from values in{' '}
          <code className="inline-code">hermes/.env</code>. To rotate context,
          seed fresh UUIDs and restart Hermes — Argus has no server-side session
          state to clear.
        </p>

        <h3
          className="uppercase"
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 500,
            fontSize: 12,
            letterSpacing: '0.15em',
            color: 'var(--color-fg-2)',
            marginTop: 36,
            marginBottom: 16,
          }}
        >
          Rotation steps
        </h3>

        <div className="space-y-3">
          <CodeBlock
            label="claude"
            lines={[
              'cd $WORK_DIR && claude',
              '# send one message, then /exit cleanly',
              '# copy the UUID from the resume hint',
              '# paste into hermes/.env as CLAUDE_SESSION_ID',
            ]}
          />
          <CodeBlock
            label="gemini"
            lines={[
              'cd $WORK_DIR && gemini',
              '# send one message, then /exit',
              '# copy UUID, paste as GEMINI_SESSION_ID',
            ]}
          />
          <CodeBlock
            label="codex"
            lines={[
              'cd $WORK_DIR && codex exec --full-auto "hello"',
              '# copy UUID from stdout header',
              '# paste as CODEX_SESSION_ID',
            ]}
          />
        </div>

        <h3
          className="uppercase"
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 500,
            fontSize: 12,
            letterSpacing: '0.15em',
            color: 'var(--color-fg-2)',
            marginTop: 28,
            marginBottom: 12,
          }}
        >
          Restart hermes
        </h3>
        <CodeBlock label="" lines={['npm run dev']} />
      </div>

      {/* Inline-code utility — scoped to the modal */}
      <style>{`
        .inline-code {
          background: var(--color-ink-2);
          color: var(--color-accent);
          padding: 1px 6px;
          font-family: var(--font-mono);
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}

function CodeBlock({ label, lines }: { label: string; lines: string[] }) {
  return (
    <div>
      {label && (
        <p
          className="uppercase"
          style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-fg-2)',
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.15em',
            marginBottom: 6,
          }}
        >
          {label}
        </p>
      )}
      <pre
        style={{
          background: 'var(--color-ink-2)',
          color: 'var(--color-fg-0)',
          border: '1px solid var(--color-ink-3)',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          lineHeight: 1.5,
          padding: '12px 16px',
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {lines.join('\n')}
      </pre>
    </div>
  );
}
