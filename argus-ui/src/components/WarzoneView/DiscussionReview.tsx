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
  /** Current warzone state so we can mark the active column + drive polling cadence. */
  state: WarzoneState;
}

type AgentKey = 'claude' | 'gemini' | 'codex';

const AGENT_LABELS: Record<AgentKey, { name: string; role: string; activeState: WarzoneState }> = {
  claude: { name: 'Claude', role: 'Planner', activeState: 'discussing_claude' },
  gemini: { name: 'Gemini', role: 'Builder', activeState: 'discussing_gemini' },
  codex: { name: 'Codex', role: 'Auditor', activeState: 'discussing_codex' },
};

const BUSY_STATES: WarzoneState[] = ['discussing_claude', 'discussing_gemini', 'discussing_codex'];

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

  // Fetch on mount + whenever state changes. Poll during busy states so Claude's
  // column fills in mid-turn rather than only showing after all three are done.
  useEffect(() => {
    fetchDiscussion();
    if (!BUSY_STATES.includes(state)) return;
    const id = setInterval(fetchDiscussion, 3000);
    return () => clearInterval(id);
  }, [fetchDiscussion, state]);

  // Stamp the start time for the current active agent so its column can show elapsed.
  // Resetting on state change gives each agent its own counter.
  const [stageStartedAt, setStageStartedAt] = useState<number>(() => Date.now());
  useEffect(() => {
    setStageStartedAt(Date.now());
  }, [state]);

  if (status === 'loading' && !sections) {
    return (
      <div style={{ padding: '24px 0', fontSize: 12, color: '#757575', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
        Loading discussion...
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div style={{ padding: '24px 0' }}>
        <p className="uppercase" style={{ fontSize: 12, fontWeight: 900, letterSpacing: '0.15em', color: '#262626', marginBottom: 8 }}>
          Failed to load WarZone.md
        </p>
        <p style={{ fontSize: 14, color: '#757575' }}>{error}</p>
      </div>
    );
  }

  const hasAnyContent = !!sections && (sections.claudePlan || sections.geminiBuild || sections.codexAudit);
  const meta = sections;

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ background: '#ffffff' }}>
      {/* Meta header — discussion number, date, idea */}
      {meta && (meta.discussionNumber || meta.date || meta.idea) && (
        <div
          className="shrink-0"
          style={{
            display: 'flex',
            gap: 32,
            padding: '8px 0 24px',
            borderBottom: '1px solid #bbbbbb',
            flexWrap: 'wrap',
          }}
        >
          {meta.discussionNumber && <Meta label="Discussion" value={`#${meta.discussionNumber}`} />}
          {meta.date && <Meta label="Date" value={meta.date} />}
          {meta.idea && <Meta label="Idea" value={meta.idea} wide />}
        </div>
      )}

      {/* Three-column layout */}
      <div className="flex-1 flex min-h-0" style={{ gap: 24, paddingTop: 24 }}>
        <AgentColumn
          agent="claude"
          body={sections?.claudePlan ?? ''}
          state={state}
          stageStartedAt={stageStartedAt}
          hasAnyContent={hasAnyContent}
        />
        <AgentColumn
          agent="gemini"
          body={sections?.geminiBuild ?? ''}
          state={state}
          stageStartedAt={stageStartedAt}
          hasAnyContent={hasAnyContent}
        />
        <AgentColumn
          agent="codex"
          body={sections?.codexAudit ?? ''}
          state={state}
          stageStartedAt={stageStartedAt}
          hasAnyContent={hasAnyContent}
        />
      </div>
    </div>
  );
}

function Meta({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div style={{ flex: wide ? 1 : undefined, minWidth: 0 }}>
      <div className="uppercase" style={{ fontSize: 12, fontWeight: 400, letterSpacing: '0.15em', color: '#757575', marginBottom: 4 }}>
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

function AgentColumn({
  agent,
  body,
  state,
  stageStartedAt,
  hasAnyContent,
}: {
  agent: AgentKey;
  body: string;
  state: WarzoneState;
  stageStartedAt: number;
  hasAnyContent: boolean;
}) {
  const cfg = AGENT_LABELS[agent];
  const isActive = state === cfg.activeState;
  const hasBody = body.trim().length > 0;
  // An agent is "done" if its section exists in the file AND we're not sitting on
  // that agent's active state. Handles the brief gap between file-append and state
  // transition on the next agent.
  const isDone = hasBody && !isActive;
  // "Waiting" = the pipeline hasn't reached this agent yet. State order is
  // idle(0) → claude(1) → gemini(2) → codex(3) → approval(4).
  const stateIndex = ['idle', 'discussing_claude', 'discussing_gemini', 'discussing_codex', 'awaiting_discuss_approval'].indexOf(state);
  const agentIndex = ['claude', 'gemini', 'codex'].indexOf(agent) + 1;
  const isWaiting = !hasBody && !isActive && stateIndex < agentIndex;
  void hasAnyContent; // reserved for future use (e.g. render nothing before first run)

  return (
    <section
      className="flex-1 flex flex-col min-h-0 min-w-0"
      style={{
        border: isActive ? '1px solid #1c69d4' : '1px solid #e5e5e5',
        background: isActive ? '#f7f9fd' : '#ffffff',
        padding: '20px 24px',
      }}
    >
      {/* Header */}
      <header className="shrink-0" style={{ marginBottom: 16 }}>
        <div className="flex items-baseline" style={{ gap: 12, marginBottom: 6 }}>
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
            {cfg.name}
          </h2>
          <span
            className="uppercase"
            style={{ fontSize: 11, fontWeight: 400, letterSpacing: '0.15em', color: '#1c69d4' }}
          >
            {cfg.role}
          </span>
        </div>
        <StatusLine
          isActive={isActive}
          isDone={isDone}
          isWaiting={isWaiting}
          stageStartedAt={stageStartedAt}
        />
      </header>

      {/* Body — scrollable markdown */}
      <div className="flex-1 overflow-y-auto min-h-0 markdown-body" style={{ paddingRight: 4 }}>
        {hasBody ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {body}
          </ReactMarkdown>
        ) : isActive ? (
          <p style={{ fontSize: 13, color: '#757575', fontStyle: 'italic' }}>
            Writing...
          </p>
        ) : (
          <p style={{ fontSize: 13, color: '#bbbbbb', fontStyle: 'italic' }}>
            {isWaiting ? 'Waiting to start.' : 'No output.'}
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
      <div className="flex items-center" style={{ gap: 8 }}>
        <span
          className="animate-pulse"
          style={{ width: 7, height: 7, borderRadius: '50%', background: '#1c69d4', display: 'inline-block' }}
        />
        <span
          className="uppercase"
          style={{
            fontSize: 11,
            letterSpacing: '0.15em',
            color: '#1c69d4',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          Running · {formatElapsed(now - stageStartedAt)}
        </span>
      </div>
    );
  }
  if (isDone) {
    return (
      <span className="uppercase" style={{ fontSize: 11, letterSpacing: '0.15em', color: '#757575' }}>
        Complete
      </span>
    );
  }
  if (isWaiting) {
    return (
      <span className="uppercase" style={{ fontSize: 11, letterSpacing: '0.15em', color: '#bbbbbb' }}>
        Waiting
      </span>
    );
  }
  return null;
}

/**
 * Extracts the latest ### Discussion N block from WarZone.md and splits it
 * into the three agent sections. Returns null if no discussion block exists.
 */
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
