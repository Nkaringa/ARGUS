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
      className="fixed inset-0 flex items-stretch justify-center z-50"
      style={{
        background: 'rgba(0,0,0,0.4)',
        padding: '40px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col bg-white"
        style={{
          width: '100%',
          maxWidth: 960,
          maxHeight: '100%',
          boxShadow: '0 24px 48px rgba(0,0,0,0.24)',
        }}
      >
        {/* Header */}
        <div
          className="shrink-0 flex items-start justify-between"
          style={{ padding: '24px 32px', borderBottom: '1px solid #e5e5e5' }}
        >
          <div className="min-w-0">
            {dirPath && (
              <div
                className="uppercase truncate"
                style={{ fontSize: 11, letterSpacing: '0.15em', color: '#757575', marginBottom: 4 }}
                title={dirPath}
              >
                {dirPath}
              </div>
            )}
            <div
              className="truncate"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 20,
                fontWeight: 700,
                color: '#262626',
                lineHeight: 1.2,
              }}
              title={filename}
            >
              {filename}
            </div>
            <div style={{ fontSize: 12, color: '#757575', marginTop: 6 }}>
              {data?.size !== undefined && <>{formatSize(data.size)}</>}
              {data?.binary && <> · binary file</>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="uppercase"
            style={{
              fontSize: 12,
              letterSpacing: '0.15em',
              color: '#262626',
              border: '1px solid #262626',
              padding: '8px 16px',
              background: 'transparent',
              cursor: 'pointer',
              flexShrink: 0,
              marginLeft: 24,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#262626';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#262626';
            }}
          >
            Close (Esc)
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: 32, fontSize: 13, color: '#757575' }}>Loading…</div>
          ) : error ? (
            <div style={{ padding: 32, fontSize: 13, color: '#a85432', lineHeight: 1.4 }}>
              {error}
            </div>
          ) : data?.binary ? (
            <div style={{ padding: 32, fontSize: 13, color: '#757575', lineHeight: 1.4 }}>
              Binary file — preview not supported. Open it in your editor from the work directory.
            </div>
          ) : (
            <pre
              style={{
                margin: 0,
                padding: '24px 32px',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                fontSize: 13,
                lineHeight: 1.5,
                color: '#262626',
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
