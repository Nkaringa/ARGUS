import { useEffect, useState } from 'react';
import { SERVERS, authHeaders } from '../../config';

interface FileContentResponse {
  content?: string;
  binary?: boolean;
  size?: number;
  mtime?: number;
  error?: string;
}

interface FilePreviewProps {
  path: string;
  onClose: () => void;
}

function formatSize(bytes?: number): string {
  if (bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function FilePreview({ path, onClose }: FilePreviewProps) {
  const [data, setData] = useState<FileContentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    fetch(`${SERVERS.build.http}/files/content?path=${encodeURIComponent(path)}`, {
      headers: authHeaders(),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        if (cancelled) return;
        if (!res.ok) {
          setError(body.error || `HTTP ${res.status}`);
        } else {
          setData(body as FileContentResponse);
        }
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  // Dismiss on Escape key so the modal feels like a real modal, not a trap.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const filename = path.split('/').pop() || path;
  const dirPath = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'center',
        padding: 40,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 960,
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
            flexShrink: 0,
            padding: '16px 22px',
            borderBottom: '1px solid var(--rule)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 18,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            {dirPath && (
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  color: 'var(--ink-dimmer)',
                  textTransform: 'uppercase',
                  marginBottom: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={dirPath}
              >
                {dirPath}
              </div>
            )}
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--ink)',
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={filename}
            >
              {filename}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-dim)', marginTop: 6 }}>
              {data?.size !== undefined && <>{formatSize(data.size)}</>}
              {data?.binary && <> · binary file</>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--ink-dim)',
              padding: '6px 12px',
              background: 'transparent',
              border: '1px solid var(--rule)',
              cursor: 'pointer',
              flexShrink: 0,
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
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {loading ? (
            <div
              style={{
                padding: 28,
                fontSize: 11,
                letterSpacing: '0.15em',
                color: 'var(--ink-dim)',
                textTransform: 'uppercase',
              }}
            >
              loading…
            </div>
          ) : error ? (
            <div
              style={{
                padding: 28,
                fontSize: 13,
                color: 'var(--warn)',
                lineHeight: 1.5,
              }}
            >
              {error}
            </div>
          ) : data?.binary ? (
            <div
              style={{
                padding: 28,
                fontSize: 13,
                color: 'var(--ink-dim)',
                lineHeight: 1.5,
              }}
            >
              binary file — preview not supported. open it in your editor from the work
              directory.
            </div>
          ) : (
            <pre
              style={{
                margin: 0,
                padding: '20px 28px',
                fontFamily: 'var(--font-body)',
                fontSize: 12.5,
                lineHeight: 1.55,
                color: 'var(--ink)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {data?.content ?? ''}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
