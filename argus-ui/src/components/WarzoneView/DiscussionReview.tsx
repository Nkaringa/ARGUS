import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SERVERS, authHeaders } from '../../config';

interface DiscussionSections {
  idea: string | null;
  date: string | null;
  discussionNumber: string | null;
  claudePlan: string;
  geminiBuild: string;
  codexAudit: string;
}

interface DiscussionReviewProps {
  /** Bumped by the parent when state enters awaiting_discuss_approval so we refetch. */
  refreshKey?: number | string;
}

export function DiscussionReview({ refreshKey }: DiscussionReviewProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'empty'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [sections, setSections] = useState<DiscussionSections | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);

    (async () => {
      try {
        const res = await fetch(`${SERVERS.warzone.http}/warzone.md`, {
          headers: authHeaders(),
        });
        if (!res.ok) {
          if (res.status === 404) {
            if (!cancelled) setStatus('empty');
            return;
          }
          const body = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status} ${body}`);
        }
        const text = await res.text();
        const parsed = extractLatestDiscussion(text);
        if (cancelled) return;
        if (!parsed) {
          setStatus('empty');
          return;
        }
        setSections(parsed);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (status === 'loading') {
    return (
      <div
        className="uppercase"
        style={{
          padding: '24px 0',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--color-fg-2)',
          letterSpacing: '0.15em',
        }}
      >
        Loading discussion...
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ padding: '24px 0' }}>
        <p
          className="uppercase"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.15em',
            color: 'var(--color-danger)',
            marginBottom: 8,
          }}
        >
          Failed to load WarZone.md
        </p>
        <p style={{ fontSize: 14, color: 'var(--color-fg-1)' }}>{error}</p>
      </div>
    );
  }

  if (status === 'empty' || !sections) {
    return (
      <div style={{ padding: '24px 0' }}>
        <p style={{ fontSize: 14, color: 'var(--color-fg-1)' }}>
          No discussion content found in WarZone.md yet.
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto min-h-0"
      style={{
        background: 'var(--color-ink-1)',
        border: '1px solid var(--color-ink-3)',
        padding: 32,
      }}
    >
      {/* Meta header */}
      <div
        style={{
          display: 'flex',
          gap: 32,
          paddingBottom: 20,
          borderBottom: '1px solid var(--color-ink-3)',
          flexWrap: 'wrap',
        }}
      >
        {sections.discussionNumber && (
          <Meta label="Discussion" value={`#${sections.discussionNumber}`} />
        )}
        {sections.date && <Meta label="Date" value={sections.date} />}
        {sections.idea && <Meta label="Idea" value={sections.idea} wide />}
      </div>

      <AgentSection label="Claude" role="Planner" body={sections.claudePlan} />
      <AgentSection label="Gemini" role="Builder" body={sections.geminiBuild} />
      <AgentSection label="Codex" role="Auditor" body={sections.codexAudit} />
    </div>
  );
}

function Meta({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div style={{ flex: wide ? 1 : undefined, minWidth: 0 }}>
      <div
        className="uppercase"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.15em',
          color: 'var(--color-fg-2)',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 400,
          color: 'var(--color-fg-0)',
          lineHeight: 1.4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function AgentSection({
  label,
  role,
  body,
}: {
  label: string;
  role: string;
  body: string;
}) {
  return (
    <section
      style={{
        padding: '28px 0',
        borderBottom: '1px solid var(--color-ink-3)',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 14,
          marginBottom: 20,
        }}
      >
        <h2
          className="uppercase"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.15em',
            color: 'var(--color-accent)',
            margin: 0,
          }}
        >
          [{label.toLowerCase()}]
        </h2>
        <span
          className="uppercase"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.15em',
            color: 'var(--color-fg-2)',
          }}
        >
          {role}
        </span>
      </header>
      <div className="markdown-body">
        {body.trim() ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {body}
          </ReactMarkdown>
        ) : (
          <p
            style={{
              fontSize: 14,
              color: 'var(--color-fg-2)',
              fontStyle: 'italic',
            }}
          >
            (no output)
          </p>
        )}
      </div>
    </section>
  );
}

// Markdown element styling — dark surface, Geist, zero radius, lime accent for links/inline code.
const baseText: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  color: 'var(--color-fg-0)',
};

const markdownComponents: import('react-markdown').Components = {
  h1: (props) => (
    <h3
      style={{
        ...baseText,
        fontSize: 20,
        fontWeight: 600,
        lineHeight: 1.3,
        margin: '20px 0 12px',
      }}
      {...props}
    />
  ),
  h2: (props) => (
    <h4
      style={{
        ...baseText,
        fontSize: 17,
        fontWeight: 600,
        lineHeight: 1.3,
        margin: '20px 0 10px',
      }}
      {...props}
    />
  ),
  h3: (props) => (
    <h5
      style={{
        ...baseText,
        fontSize: 15,
        fontWeight: 600,
        lineHeight: 1.3,
        margin: '16px 0 8px',
      }}
      {...props}
    />
  ),
  h4: (props) => (
    <h6
      style={{
        ...baseText,
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.3,
        margin: '14px 0 6px',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
      }}
      {...props}
    />
  ),
  p: (props) => (
    <p
      style={{
        ...baseText,
        fontSize: 15,
        fontWeight: 400,
        lineHeight: 1.6,
        margin: '0 0 12px',
      }}
      {...props}
    />
  ),
  ul: (props) => (
    <ul
      style={{
        ...baseText,
        fontSize: 15,
        fontWeight: 400,
        lineHeight: 1.6,
        margin: '0 0 12px',
        paddingLeft: 24,
      }}
      {...props}
    />
  ),
  ol: (props) => (
    <ol
      style={{
        ...baseText,
        fontSize: 15,
        fontWeight: 400,
        lineHeight: 1.6,
        margin: '0 0 12px',
        paddingLeft: 24,
      }}
      {...props}
    />
  ),
  li: (props) => <li style={{ marginBottom: 4 }} {...props} />,
  strong: (props) => (
    <strong style={{ fontWeight: 600, color: 'var(--color-fg-0)' }} {...props} />
  ),
  em: (props) => <em style={{ fontStyle: 'italic' }} {...props} />,
  a: (props) => (
    <a
      style={{
        color: 'var(--color-accent)',
        textDecoration: 'none',
        borderBottom: '1px solid var(--color-accent)',
      }}
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  code: ({ children, className, ...rest }) => {
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <code
          className={className}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            color: 'var(--color-fg-0)',
          }}
          {...rest}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        style={{
          background: 'var(--color-ink-2)',
          color: 'var(--color-accent)',
          padding: '1px 6px',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
        }}
        {...rest}
      >
        {children}
      </code>
    );
  },
  pre: (props) => (
    <pre
      style={{
        background: 'var(--color-ink-2)',
        color: 'var(--color-fg-0)',
        border: '1px solid var(--color-ink-3)',
        padding: '14px 18px',
        overflowX: 'auto',
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        lineHeight: 1.5,
        margin: '0 0 14px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
      {...props}
    />
  ),
  blockquote: (props) => (
    <blockquote
      style={{
        borderLeft: '2px solid var(--color-accent)',
        paddingLeft: 16,
        margin: '0 0 12px',
        color: 'var(--color-fg-1)',
        fontSize: 15,
        lineHeight: 1.55,
      }}
      {...props}
    />
  ),
  hr: () => (
    <hr
      style={{
        border: 'none',
        borderTop: '1px solid var(--color-ink-3)',
        margin: '24px 0',
      }}
    />
  ),
  table: (props) => (
    <div style={{ overflowX: 'auto', marginBottom: 16 }}>
      <table
        style={{
          borderCollapse: 'collapse',
          width: '100%',
          fontSize: 14,
          ...baseText,
        }}
        {...props}
      />
    </div>
  ),
  th: (props) => (
    <th
      style={{
        textAlign: 'left',
        padding: '8px 12px',
        borderBottom: '1px solid var(--color-fg-0)',
        fontWeight: 600,
        textTransform: 'uppercase',
        fontSize: 12,
        letterSpacing: '0.1em',
        fontFamily: 'var(--font-mono)',
      }}
      {...props}
    />
  ),
  td: (props) => (
    <td
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--color-ink-3)',
      }}
      {...props}
    />
  ),
};

/**
 * Extracts the latest ### Discussion N block from WarZone.md and splits it
 * into the three agent sections. Returns null if no discussion block exists.
 */
function extractLatestDiscussion(md: string): DiscussionSections | null {
  const blocks = md
    .split(/(?=^### Discussion \d+)/m)
    .filter((b) => /^### Discussion \d+/m.test(b));
  if (blocks.length === 0) return null;
  const block = blocks[blocks.length - 1];

  const numMatch = block.match(/^### Discussion (\d+)/m);
  const ideaMatch = block.match(/^\*\*Idea:\*\*\s*(.+)$/m);
  const dateMatch = block.match(/^\*\*Date:\*\*\s*(.+)$/m);

  return {
    discussionNumber: numMatch?.[1] ?? null,
    idea: ideaMatch?.[1]?.trim() ?? null,
    date: dateMatch?.[1]?.trim() ?? null,
    claudePlan: cleanSection(extractSubsection(block, "Claude's Plan")),
    geminiBuild: cleanSection(extractSubsection(block, "Gemini's Build Approach")),
    codexAudit: cleanSection(extractSubsection(block, "Codex's Audit")),
  };
}

function extractSubsection(block: string, heading: string): string {
  const re = new RegExp(
    `^####\\s+${heading.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*$([\\s\\S]*?)(?=^####\\s|$(?![\\r\\n]))`,
    'm',
  );
  const m = block.match(re);
  return m ? m[1].trim() : '';
}

function cleanSection(body: string): string {
  // Strip the status-marker lines — they're for the watcher, not humans.
  const markers = [
    /^\*\*Planner Status:\*\*\s*DONE\s*$/m,
    /^\*\*Builder Status:\*\*\s*DONE\s*$/m,
    /^\*\*Auditor Status:\*\*\s*READY TO BUILD\s*$/m,
  ];
  let cleaned = body;
  for (const m of markers) cleaned = cleaned.replace(m, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
}
