import { useEffect, useState } from 'react';
import { SERVERS, authHeaders } from '../../config';
import { Panel } from '../shared/Panel';

interface FileContentResponse {
  content?: string;
  binary?: boolean;
  size?: number;
  mtime?: number;
  error?: string;
}

function formatSize(bytes?: number): string {
  if (bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Inline (non-modal) file content pane used by workspace mode. Same fetch logic as
 * FilePreview but renders in its own flex column next to the tree rather than as a
 * centered overlay. When no file is selected it shows a placeholder.
 */
export function InlinePreview({ path }: { path: string | null }) {
  const [data, setData] = useState<FileContentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
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

  if (!path) {
    return (
      <Panel fill headLabel="preview" headRight="no file selected">
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 40,
            color: 'var(--ink-dimmer)',
            fontSize: 13,
            lineHeight: 1.5,
            textAlign: 'center',
          }}
        >
          click a file in the tree to view its contents.
        </div>
      </Panel>
    );
  }

  const filename = path.split('/').pop() || path;
  const dirPath = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  const sizeBadge = data?.size !== undefined ? formatSize(data.size) : '';
  const headRight = data?.binary ? 'binary' : sizeBadge;

  return (
    <Panel fill headLabel={filename} headRight={headRight}>
      {dirPath && (
        <div
          style={{
            padding: '6px 18px',
            borderBottom: '1px dashed var(--rule)',
            fontSize: 10,
            letterSpacing: '0.12em',
            color: 'var(--ink-dimmer)',
            textTransform: 'uppercase',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
          title={dirPath}
        >
          {dirPath}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {loading ? (
          <div
            style={{
              padding: '20px 22px',
              fontSize: 10,
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
              padding: '20px 22px',
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
              padding: '20px 22px',
              fontSize: 13,
              color: 'var(--ink-dim)',
              lineHeight: 1.5,
            }}
          >
            binary file — preview not supported. open it in your editor from the work directory.
          </div>
        ) : (
          <pre
            style={{
              margin: 0,
              padding: '18px 22px',
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
    </Panel>
  );
}
