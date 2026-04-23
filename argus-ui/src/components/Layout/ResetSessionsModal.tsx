import { useEffect } from 'react';

interface ResetSessionsModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Documentation-only modal. No fetch, no backend call, no state mutation.
 * Tells the user how to re-authenticate a CLI when its vendor auth expires.
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
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 640,
          maxHeight: '100%',
          background: 'var(--bg-2)',
          border: '1px solid var(--rule)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--rule)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 10,
            letterSpacing: '0.16em',
            color: 'var(--ink-dimmer)',
            textTransform: 'uppercase',
          }}
        >
          <span style={{ color: 'var(--accent)' }}>▸</span>
          refresh agent auth
          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--ink-dim)',
              padding: '4px 10px',
              border: '1px solid var(--rule)',
              background: 'transparent',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--accent)';
              e.currentTarget.style.borderColor = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--ink-dim)';
              e.currentTarget.style.borderColor = 'var(--rule)';
            }}
          >
            close (esc)
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', overflowY: 'auto' }}>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              fontWeight: 500,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
              marginBottom: 16,
            }}
          >
            re-authenticate a cli
          </h2>

          <p
            style={{
              color: 'var(--ink-dim)',
              fontSize: 13,
              lineHeight: 1.6,
              marginBottom: 20,
            }}
          >
            if an agent is failing with an auth or login error, re-authenticate
            its cli directly in your terminal. argus picks up the refreshed auth
            on the next invocation.
          </p>

          <pre
            style={{
              background: 'var(--bg-3)',
              border: '1px solid var(--rule)',
              padding: '14px 16px',
              margin: 0,
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              lineHeight: 1.7,
              color: 'var(--ink)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            <span style={{ color: 'var(--claude)' }}>claude</span>
            {'\n'}
            <span style={{ color: 'var(--gemini)' }}>gemini</span>
            {'\n'}
            <span style={{ color: 'var(--codex)' }}>codex</span>
            {'\n'}
            <span style={{ color: 'var(--ink-dimmer)' }}>
              # follow the login prompt, then exit
            </span>
          </pre>

          <p
            style={{
              marginTop: 20,
              fontSize: 12,
              lineHeight: 1.6,
              color: 'var(--ink-dimmer)',
            }}
          >
            no{' '}
            <code
              style={{
                background: 'var(--bg-3)',
                color: 'var(--accent)',
                padding: '1px 6px',
                fontSize: 11,
                border: '1px solid var(--rule)',
              }}
            >
              .env
            </code>{' '}
            edit, no hermes restart — each cli caches its own auth, and argus
            reads that cache every time it spawns the cli.
          </p>
        </div>
      </div>
    </div>
  );
}

