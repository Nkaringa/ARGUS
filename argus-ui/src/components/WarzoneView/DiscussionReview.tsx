import { useCallback, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SERVERS, authHeaders } from '../../config';
import { markdownComponents } from '../shared/markdownComponents';
import type { WarzoneState } from '../../types';

interface DiscussionSections {
  idea: string | null;
  date: string | null;
  discussionNumber: string | null;
  claudePlan: string;
  geminiBuild: string;
  codexAudit: string;
}

interface DiscussionReviewProps {
  /** Current warzone state — drives per-column status (running / done / waiting). */
  state: WarzoneState;
}

type AgentKey = 'claude' | 'gemini' | 'codex';

const AGENT_CONFIG: Record<
  AgentKey,
  { name: string; role: string; activeState: WarzoneState; color: string }
> = {
  claude: { name: 'claude', role: 'planner', activeState: 'discussing_claude', color: 'var(--claude)' },
  gemini: { name: 'gemini', role: 'builder', activeState: 'discussing_gemini', color: 'var(--gemini)' },
  codex:  { name: 'codex',  role: 'auditor', activeState: 'discussing_codex',  color: 'var(--codex)'  },
};

const BUSY_STATES: WarzoneState[] = [
  'discussing_claude',
  'discussing_gemini',
  'discussing_codex',
];

const STATE_ORDER: WarzoneState[] = [
  'idle',
  'discussing_claude',
  'discussing_gemini',
  'discussing_codex',
  'awaiting_discuss_approval',
];

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

export function DiscussionReview({ state }: DiscussionReviewProps) {
  const [sections, setSections] = useState<DiscussionSections | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'empty'>('loading');
  const [error, setError] = useState<string | null>(null);

  const fetchDiscussion = useCallback(async () => {
    try {
      const res = await fetch(`${SERVERS.warzone.http}/warzone.md`, { headers: authHeaders() });
      if (res.status === 404) {
        setStatus('empty');
        setSections(null);
        return;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${body}`);
      }
      const text = await res.text();
      const parsed = extractLatestDiscussion(text);
      if (!parsed) {
        setStatus('empty');
        setSections(null);
        return;
      }
      setSections(parsed);
      setStatus('ready');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    fetchDiscussion();
    if (!BUSY_STATES.includes(state)) return;
    const id = setInterval(fetchDiscussion, 3000);
    return () => clearInterval(id);
  }, [fetchDiscussion, state]);

  const [stageStartedAt, setStageStartedAt] = useState<number>(() => Date.now());
  useEffect(() => {
    setStageStartedAt(Date.now());
  }, [state]);

  if (status === 'loading' && !sections) {
    return (
      <div
        style={{
          padding: '16px 20px',
          fontSize: 10,
          letterSpacing: '0.15em',
          color: 'var(--ink-dim)',
          textTransform: 'uppercase',
        }}
      >
        Loading discussion...
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ padding: '16px 20px' }}>
        <p
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.15em',
            color: 'var(--warn)',
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          Failed to load WarZone.md
        </p>
        <p style={{ fontSize: 12, color: 'var(--ink-dim)' }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minHeight: 0 }}>
      {sections && (sections.discussionNumber || sections.date || sections.idea) && (
        <div
          style={{
            display: 'flex',
            gap: 28,
            flexWrap: 'wrap',
            padding: '12px 18px',
            border: '1px solid var(--rule)',
            background: 'var(--bg-2)',
          }}
        >
          {sections.discussionNumber && (
            <Meta label="discussion" value={`#${sections.discussionNumber}`} />
          )}
          {sections.date && <Meta label="date" value={sections.date} />}
          {sections.idea && <Meta label="idea" value={sections.idea} wide />}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 18,
          minHeight: 320,
        }}
      >
        {(['claude', 'gemini', 'codex'] as AgentKey[]).map((key) => (
          <AgentColumn
            key={key}
            agent={key}
            body={
              key === 'claude'
                ? (sections?.claudePlan ?? '')
                : key === 'gemini'
                  ? (sections?.geminiBuild ?? '')
                  : (sections?.codexAudit ?? '')
            }
            state={state}
            stageStartedAt={stageStartedAt}
          />
        ))}
      </div>
    </div>
  );
}

function Meta({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div style={{ flex: wide ? 1 : undefined, minWidth: 0 }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.16em',
          color: 'var(--ink-dimmer)',
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--ink)',
          lineHeight: 1.4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: wide ? 'normal' : 'nowrap',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function AgentColumn({
  agent,
  body,
  state,
  stageStartedAt,
}: {
  agent: AgentKey;
  body: string;
  state: WarzoneState;
  stageStartedAt: number;
}) {
  const cfg = AGENT_CONFIG[agent];
  const isActive = state === cfg.activeState;
  const hasBody = body.trim().length > 0;
  const isDone = hasBody && !isActive;
  const thisIdx = STATE_ORDER.indexOf(cfg.activeState);
  const curIdx = STATE_ORDER.indexOf(state);
  const isWaiting = !hasBody && !isActive && curIdx < thisIdx;

  return (
    <section
      style={{
        border: `1px solid ${isActive ? cfg.color : 'var(--rule)'}`,
        // Active column gets the same colored-glow halo as the pipeline strip's
        // active step — agent identity color in border + outer halo. Done columns
        // get a subtle accent-tint so they read as "sealed and complete."
        boxShadow: isActive
          ? `0 0 18px -2px ${cfg.color}, 0 0 4px -1px ${cfg.color}`
          : 'none',
        background: isDone ? 'var(--accent-tint-soft)' : 'var(--bg-2)',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        // Cap column height so long agent output scrolls WITHIN the column instead
        // of stretching the page vertically. 65vh leaves the hero + pipeline
        // visible above on typical screens.
        height: '65vh',
        maxHeight: '65vh',
        transition: 'border-color 0.2s, box-shadow 0.25s, background 0.2s',
      }}
    >
      <header
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--rule)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              fontWeight: 500,
              color: cfg.color,
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            {cfg.name}
          </h2>
          <span
            style={{
              fontSize: 10,
              fontWeight: 400,
              letterSpacing: '0.16em',
              color: 'var(--ink-dim)',
              textTransform: 'uppercase',
            }}
          >
            [ {cfg.role} ]
          </span>
        </div>
        <StatusLine
          isActive={isActive}
          isDone={isDone}
          isWaiting={isWaiting}
          stageStartedAt={stageStartedAt}
        />
      </header>

      <div
        className="markdown-body"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 18px',
          color: 'var(--ink)',
          fontSize: 12.5,
          lineHeight: 1.55,
          minHeight: 0,
        }}
      >
        {hasBody ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {body}
          </ReactMarkdown>
        ) : isActive ? (
          <p style={{ color: 'var(--ink-dim)', fontStyle: 'italic' }}>writing...</p>
        ) : (
          <p style={{ color: 'var(--ink-dimmer)', fontStyle: 'italic' }}>
            {isWaiting ? 'waiting to start.' : 'no output.'}
          </p>
        )}
      </div>
    </section>
  );
}

function StatusLine({
  isActive,
  isDone,
  isWaiting,
  stageStartedAt,
}: {
  isActive: boolean;
  isDone: boolean;
  isWaiting: boolean;
  stageStartedAt: number;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isActive]);

  if (isActive) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--accent)',
            animation: 'pulse 1.4s ease-in-out infinite',
            display: 'inline-block',
          }}
        />
        <span
          style={{
            fontSize: 10,
            letterSpacing: '0.15em',
            color: 'var(--accent)',
            fontVariantNumeric: 'tabular-nums',
            textTransform: 'uppercase',
          }}
        >
          running · {formatElapsed(now - stageStartedAt)}
        </span>
      </div>
    );
  }
  if (isDone) {
    return (
      <span
        style={{
          fontSize: 10,
          letterSpacing: '0.15em',
          color: 'var(--ink-dim)',
          textTransform: 'uppercase',
        }}
      >
        ✓ complete
      </span>
    );
  }
  if (isWaiting) {
    return (
      <span
        style={{
          fontSize: 10,
          letterSpacing: '0.15em',
          color: 'var(--ink-dimmer)',
          textTransform: 'uppercase',
        }}
      >
        waiting
      </span>
    );
  }
  return null;
}

function extractLatestDiscussion(md: string): DiscussionSections | null {
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
