import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SERVERS, authHeaders } from '../../config';
import { markdownComponents } from '../shared/markdownComponents';

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
        style={{
          padding: '24px 0',
          fontSize: 12,
          color: '#757575',
          textTransform: 'uppercase',
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
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: '0.15em',
            color: '#262626',
            marginBottom: 8,
          }}
        >
          Failed to load WarZone.md
        </p>
        <p style={{ fontSize: 14, color: '#757575' }}>{error}</p>
      </div>
    );
  }

  if (status === 'empty' || !sections) {
    return (
      <div style={{ padding: '24px 0' }}>
        <p style={{ fontSize: 14, color: '#757575' }}>
          No discussion content found in WarZone.md yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0" style={{ background: '#ffffff' }}>
      {/* Meta header */}
      <div
        style={{
          display: 'flex',
          gap: 32,
          padding: '8px 0 24px',
          borderBottom: '1px solid #bbbbbb',
          flexWrap: 'wrap',
        }}
      >
        {sections.discussionNumber && (
          <Meta label="Discussion" value={`#${sections.discussionNumber}`} />
        )}
        {sections.date && <Meta label="Date" value={sections.date} />}
        {sections.idea && <Meta label="Idea" value={sections.idea} wide />}
      </div>

      <AgentSection
        label="Claude"
        role="Planner"
        body={sections.claudePlan}
      />
      <AgentSection
        label="Gemini"
        role="Builder"
        body={sections.geminiBuild}
      />
      <AgentSection
        label="Codex"
        role="Auditor"
        body={sections.codexAudit}
      />
    </div>
  );
}

function Meta({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div style={{ flex: wide ? 1 : undefined, minWidth: 0 }}>
      <div
        className="uppercase"
        style={{
          fontSize: 12,
          fontWeight: 400,
          letterSpacing: '0.15em',
          color: '#757575',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 400,
          color: '#262626',
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function AgentSection({ label, role, body }: { label: string; role: string; body: string }) {
  return (
    <section
      style={{
        padding: '32px 0',
        borderBottom: '1px solid #bbbbbb',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <h2
          className="uppercase"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 18,
            fontWeight: 900,
            letterSpacing: '0.15em',
            color: '#262626',
            margin: 0,
          }}
        >
          {label}
        </h2>
        <span
          className="uppercase"
          style={{
            fontSize: 12,
            fontWeight: 400,
            letterSpacing: '0.15em',
            color: '#1c69d4',
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
          <p style={{ fontSize: 14, color: '#757575', fontStyle: 'italic' }}>
            (no output)
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * Extracts the latest ### Discussion N block from WarZone.md and splits it
 * into the three agent sections. Returns null if no discussion block exists.
 */
function extractLatestDiscussion(md: string): DiscussionSections | null {
  // Find all "### Discussion N" headings with their content spans
  const blocks = md.split(/(?=^### Discussion \d+)/m).filter((b) => /^### Discussion \d+/m.test(b));
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
  // Trim excess blank lines left by removals
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
}
