import { useEffect, useState } from 'react';
import { SERVERS, authHeaders } from '../../config';

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

function formatAgo(mtime?: number): string {
  if (!mtime) return '';
  const diff = Date.now() - mtime;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(mtime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Infer who wrote a file from its filename pattern. Only the meta files are
// agent-identifiable (Plan / Build-Log / Build-Feedback); regular deliverables
// (index.html, app.js, etc.) come from gemini implicitly but we don't surface
// that here — too speculative for "agent X wrote this exact file."
function inferAgent(filename: string): { name: 'claude' | 'gemini' | 'codex'; color: string } | null {
  if (/-Plan\.md$/i.test(filename))          return { name: 'claude', color: 'var(--claude)' };
  if (/-Build-Log\.md$/i.test(filename))     return { name: 'gemini', color: 'var(--gemini)' };
  if (/-Build-Feedback\.md$/i.test(filename))return { name: 'codex',  color: 'var(--codex)' };
  return null;
}

/**
 * Inline file preview pane for workspace mode. Path breadcrumb + copy actions
 * + metadata strip (size · line count · modified-ago · agent attribution) +
 * line-numbered code body. Self-contained: derives metadata from the
 * /files/content response (size, mtime), no parent threading required.
 */
export function InlinePreview({ path }: { path: string | null }) {
  const [data, setData] = useState<FileContentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Brief "✓ copied" flash on copy buttons.
  const [copiedPath, setCopiedPath] = useState(false);
  const [copiedContents, setCopiedContents] = useState(false);

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

    return () => { cancelled = true; };
  }, [path]);

  if (!path) {
    return (
      <section style={shellStyle}>
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
      </section>
    );
  }

  const segments = path.split('/').filter(Boolean);
  const filename = segments[segments.length - 1] ?? path;
  const agent = inferAgent(filename);
  const lineCount = data?.content ? data.content.split('\n').length : 0;

  const copy = (text: string, setFlag: (b: boolean) => void) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setFlag(true);
        setTimeout(() => setFlag(false), 900);
      })
      .catch(() => { /* clipboard unavailable — silent */ });
  };

  return (
    <section style={shellStyle}>
      {/* Header — breadcrumb + copy actions */}
      <div
        style={{
          padding: '12px 18px',
          borderBottom: '1px solid var(--rule)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <Breadcrumb segments={segments} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <CopyButton
            label="copy path"
            confirmed={copiedPath}
            onClick={() => copy(path, setCopiedPath)}
          />
          <CopyButton
            label="copy contents"
            confirmed={copiedContents}
            onClick={() => data?.content && copy(data.content, setCopiedContents)}
            disabled={!data?.content}
          />
        </div>
      </div>

      {/* Metadata strip — only when we have a successful fetch */}
      {data && !data.binary && (
        <div
          style={{
            padding: '8px 18px',
            borderBottom: '1px dashed var(--rule)',
            display: 'flex',
            gap: 18,
            flexWrap: 'wrap',
            fontSize: 10,
            letterSpacing: '0.12em',
            color: 'var(--ink-dimmer)',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          <span>
            <b style={{ color: 'var(--ink-dim)', fontWeight: 500 }}>{formatSize(data.size)}</b>
            {lineCount > 0 && ` · ${lineCount} lines`}
          </span>
          {data.mtime && (
            <span>
              modified <b style={{ color: 'var(--ink-dim)', fontWeight: 500 }}>{formatAgo(data.mtime)}</b>
            </span>
          )}
          {agent && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              written by
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '2px 6px',
                  border: `1px solid ${agent.color}`,
                  fontFamily: 'var(--font-display)',
                  fontSize: 11,
                  letterSpacing: '-0.01em',
                  color: agent.color,
                  textTransform: 'lowercase',
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: agent.color,
                  }}
                />
                {agent.name}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {loading ? (
          <BodyMessage>loading…</BodyMessage>
        ) : error ? (
          <BodyMessage warn>{error}</BodyMessage>
        ) : data?.binary ? (
          <BodyMessage>
            binary file — preview not supported. open it in your editor from the work directory.
          </BodyMessage>
        ) : !data?.content ? (
          <BodyMessage>(file is empty)</BodyMessage>
        ) : (
          <CodeBody content={data.content} />
        )}
      </div>
    </section>
  );
}

const shellStyle: React.CSSProperties = {
  border: '1px solid var(--rule)',
  background: 'var(--bg-2)',
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  minHeight: 0,
  height: '100%',
};

function Breadcrumb({ segments }: { segments: string[] }) {
  if (segments.length === 0) return null;
  return (
    <div
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
        minWidth: 0,
      }}
    >
      {segments.map((seg, i) => {
        const last = i === segments.length - 1;
        return (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {i > 0 && <span style={{ color: 'var(--rule-hot)' }}>/</span>}
            <span
              style={{
                color: last ? 'var(--ink)' : 'var(--ink-dim)',
                fontWeight: last ? 500 : 400,
              }}
            >
              {seg}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function CopyButton({
  label,
  confirmed,
  onClick,
  disabled,
}: {
  label: string;
  confirmed: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '4px 10px',
        fontSize: 10,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: confirmed ? 'var(--accent)' : 'var(--ink-dim)',
        background: 'transparent',
        border: `1px solid ${confirmed ? 'var(--accent)' : 'var(--rule)'}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'color 0.15s, border-color 0.15s',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => {
        if (disabled || confirmed) return;
        e.currentTarget.style.color = 'var(--accent)';
        e.currentTarget.style.borderColor = 'var(--accent)';
      }}
      onMouseLeave={(e) => {
        if (disabled || confirmed) return;
        e.currentTarget.style.color = 'var(--ink-dim)';
        e.currentTarget.style.borderColor = 'var(--rule)';
      }}
    >
      <span style={{ marginRight: 4 }}>{confirmed ? '✓' : '⎘'}</span>
      {confirmed ? 'copied' : label}
    </button>
  );
}

function BodyMessage({ children, warn }: { children: React.ReactNode; warn?: boolean }) {
  return (
    <div
      style={{
        padding: '20px 22px',
        fontSize: 12,
        color: warn ? 'var(--warn)' : 'var(--ink-dim)',
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

// Line-numbered code body. CSS counter increments per line; the line-number
// column is generated via a ::before pseudo-element on each .ln row. Pure CSS,
// no syntax highlighting (line numbers + monospace already a solid upgrade
// vs the previous flat <pre> rendering).
function CodeBody({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div
      style={{
        padding: '14px 0 24px',
        fontFamily: 'var(--font-body)',
        fontSize: 12.5,
        lineHeight: 1.6,
        minHeight: '100%',
      }}
    >
      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: '56px 1fr',
            gap: 14,
          }}
        >
          <span
            style={{
              textAlign: 'right',
              color: 'var(--ink-dimmer)',
              userSelect: 'none',
              fontVariantNumeric: 'tabular-nums',
              paddingRight: 8,
              borderRight: '1px dashed var(--rule)',
            }}
          >
            {i + 1}
          </span>
          <span
            style={{
              color: 'var(--ink)',
              paddingRight: 18,
              whiteSpace: 'pre',
            }}
          >
            {line || ' ' /* non-breaking space keeps blank lines visible */}
          </span>
        </div>
      ))}
    </div>
  );
}
