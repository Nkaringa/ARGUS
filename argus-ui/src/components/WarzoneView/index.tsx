import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { WarzoneState, OutputLine } from '../../types';
import { DiscussionReview } from './DiscussionReview';
import { Panel, ActionButton } from '../shared/Panel';

interface WarzoneViewProps {
  state: WarzoneState;
  idea: string | null;
  slug: string | null;
  lines: OutputLine[];
  droppedLineCount: number;
  stageStartedAt: number;
  onSubmit: (idea: string) => void;
  onApprove: () => void;
  onAbort: () => void;
  onNewDiscussion: () => void;
}

// Maps active state → agent identity color, used by HeroCard's inline "<agent>
// is debating" block and by the PipelineStrip's per-step active glow.
const AGENT_FOR_STATE: Partial<Record<WarzoneState, { agent: string; agentColor: string; description: string }>> = {
  discussing_claude: { agent: 'claude', agentColor: 'var(--claude)', description: 'framing the idea · slug + plan' },
  discussing_gemini: { agent: 'gemini', agentColor: 'var(--gemini)', description: 'proposing build approach · stack & steps' },
  discussing_codex:  { agent: 'codex',  agentColor: 'var(--codex)',  description: 'auditing both takes · poking holes' },
};

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

const STATE_ORDER: WarzoneState[] = [
  'idle',
  'discussing_claude',
  'discussing_gemini',
  'discussing_codex',
  'awaiting_discuss_approval',
];

const PIPELINE_STEPS: {
  key: string;
  label: string;
  agent: string;
  agentColor: string | null;
  matchStates: WarzoneState[];
}[] = [
  { key: 'plan',   label: 'plan',   agent: 'claude', agentColor: 'var(--claude)', matchStates: ['discussing_claude'] },
  { key: 'build',  label: 'build',  agent: 'gemini', agentColor: 'var(--gemini)', matchStates: ['discussing_gemini'] },
  { key: 'audit',  label: 'audit',  agent: 'codex',  agentColor: 'var(--codex)',  matchStates: ['discussing_codex'] },
  { key: 'review', label: 'review', agent: 'you',    agentColor: null,            matchStates: ['awaiting_discuss_approval'] },
];

function stateIndex(s: WarzoneState): number {
  const i = STATE_ORDER.indexOf(s);
  return i < 0 ? 0 : i;
}

/* Breadcrumbs deleted — section is in the sidebar's active item, slug lives in
   the hero, ws status is implementation noise. */

/* ────────────────────────────── hero card ────────────────────────────── */

function HeroCard({
  state,
  slug,
  idea,
  stageStartedAt,
  onNewDiscussion,
  canStartNewDiscussion,
}: {
  state: WarzoneState;
  slug: string | null;
  idea: string | null;
  stageStartedAt: number;
  onNewDiscussion: () => void;
  canStartNewDiscussion: boolean;
}) {
  const stateLabel =
    state === 'idle' ? 'ready' :
    state === 'awaiting_discuss_approval' ? 'awaiting review' :
    state.replace(/_/g, ' ');

  // Live elapsed counter — re-renders the hero once per second while a round
  // is in flight. Cleanly stops the interval for idle / awaiting-approval.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!['discussing_claude', 'discussing_gemini', 'discussing_codex'].includes(state)) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state]);

  const stageCfg = AGENT_FOR_STATE[state];

  return (
    <section
      style={{
        border: '1px solid var(--rule)',
        background: 'var(--bg-2)',
        display: 'flex',
        alignItems: 'stretch',
        gap: 24,
        padding: '22px 26px',
        minHeight: 0,
      }}
    >
      {/* Left column — slug + idea + (when a round is live) inline agent block. */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px, 4vw, 44px)',
            fontWeight: 500,
            lineHeight: 1,
            letterSpacing: '-0.03em',
            margin: 0,
            display: 'flex',
            alignItems: 'baseline',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          {slug ? (
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 18,
                fontWeight: 500,
                background: 'var(--accent)',
                color: 'var(--accent-ink)',
                padding: '2px 8px',
              }}
            >
              {slug}
            </span>
          ) : (
            <span style={{ color: 'var(--ink-dimmer)' }}>no active discussion</span>
          )}
        </h1>
        {idea && (
          <p
            style={{
              marginTop: 14,
              fontSize: 13,
              color: 'var(--ink)',
              lineHeight: 1.55,
              maxWidth: '80ch',
            }}
          >
            <span style={{ color: 'var(--ink-dim)' }}>$ idea →</span> {idea}
          </p>
        )}

        {/* Inline "<agent> is debating" block — only renders during a working
            state (discussing_claude / _gemini / _codex). Agent identity color
            on the name; static pulse-dot meta line above. */}
        {stageCfg && (
          <div
            style={{
              marginTop: 18,
              paddingTop: 14,
              borderTop: '1px dashed var(--rule)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 10,
                letterSpacing: '0.16em',
                color: 'var(--ink-dimmer)',
                textTransform: 'uppercase',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  background: 'var(--accent)',
                  borderRadius: '50%',
                  animation: 'pulse 1.4s ease-in-out infinite',
                }}
              />
              {stageCfg.agent} :: {stageCfg.description}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 28,
                fontWeight: 500,
                lineHeight: 1.05,
                letterSpacing: '-0.03em',
              }}
            >
              <span style={{ color: stageCfg.agentColor }}>{stageCfg.agent}</span>{' '}
              <span style={{ color: 'var(--ink)' }}>is debating</span>
            </div>
          </div>
        )}
      </div>

      {/* Right column — state tag + started-ago anchor at the top, the
          ↻ new-discussion action anchored at the bottom (with a small caption
          above so the user knows what it does). The flex gap fills the middle. */}
      <div
        style={{
          width: 260,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          alignItems: 'stretch',
        }}
      >
        {/* TOP — state tag + started-ago. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          <span
            style={{
              fontSize: 10,
              letterSpacing: '0.18em',
              color: 'var(--ink-dimmer)',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            // discussion state: <b style={{ color: 'var(--accent)', fontWeight: 500 }}>{stateLabel}</b>
          </span>
          {state !== 'idle' && (
            <span
              style={{
                fontSize: 10,
                letterSpacing: '0.12em',
                color: 'var(--ink-dimmer)',
                textTransform: 'uppercase',
              }}
            >
              started <b style={{ color: 'var(--ink-dim)', fontWeight: 500 }}>{formatElapsed(now - stageStartedAt)}</b> ago
            </span>
          )}
        </div>

        {/* BOTTOM — caption + ↻ new-discussion. margin-top: auto pushes the
            group to the bottom edge of the hero so it lives where the user
            looks for "what can I do next." Lime fill matches the input panel's
            primary submit button so the user reads it as a real action. */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          <span
            style={{
              fontSize: 9,
              letterSpacing: '0.14em',
              color: 'var(--ink-dimmer)',
              textTransform: 'uppercase',
              lineHeight: 1.3,
              textAlign: 'right',
              maxWidth: 220,
            }}
          >
            archive this topic &amp; start fresh
          </span>
          <button
            type="button"
            onClick={onNewDiscussion}
            disabled={!canStartNewDiscussion}
            title={
              !slug
                ? 'no active discussion to archive — submit one first'
                : !canStartNewDiscussion
                  ? 'wait for the current round to finish'
                  : 'archive this discussion and start a new topic'
            }
            style={{
              padding: '8px 14px',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--accent-ink)',
              background: 'var(--accent)',
              border: 'none',
              cursor: canStartNewDiscussion ? 'pointer' : 'not-allowed',
              opacity: canStartNewDiscussion ? 1 : 0.5,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              if (canStartNewDiscussion) e.currentTarget.style.background = 'var(--accent-hover)';
            }}
            onMouseLeave={(e) => {
              if (canStartNewDiscussion) e.currentTarget.style.background = 'var(--accent)';
            }}
          >
            ↻ new discussion
          </button>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────── pipeline strip ────────────────────────────── */

// Glow color when a step is active. claude/gemini/codex use their identity
// colors (already on step.agentColor). "review" is human-driven, so warn (red)
// to read as "your turn."
function activeGlow(step: typeof PIPELINE_STEPS[number]): string {
  if (step.agentColor) return step.agentColor;
  if (step.key === 'review') return 'var(--warn)';
  return 'var(--accent)';
}

function PipelineStrip({ state }: { state: WarzoneState }) {
  const currentIdx = stateIndex(state);
  return (
    <section
      style={{
        marginTop: 18,
        border: '1px solid var(--rule)',
        background: 'var(--bg-2)',
        padding: '18px 22px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 10,
          letterSpacing: '0.16em',
          color: 'var(--ink-dimmer)',
          textTransform: 'uppercase',
          marginBottom: 14,
        }}
      >
        <span style={{ color: 'var(--rule-hot)', letterSpacing: 0 }}>┌──</span>
        sequence · claude → gemini → codex → review
      </div>
      <div
        style={{
          display: 'grid',
          // Production-equivalent layout (4 cards + 3 arrows). Trailing 40px
          // empty column gives a tiny right-edge breath so the strip doesn't
          // bleed into its own border — feels less crowded than full-fill.
          gridTemplateColumns: '1fr auto 1fr auto 1fr auto 1fr 40px',
          gap: 12,
          alignItems: 'stretch',
        }}
      >
        {PIPELINE_STEPS.map((step, i) => {
          const stepIdx = STATE_ORDER.indexOf(step.matchStates[0]);
          const done = currentIdx > stepIdx;
          const active = step.matchStates.includes(state);

          // ACTIVE: agent-color glow (transparent bg + colored border + outer
          // halo). DONE: sunken accent-tint-soft + ✓. QUEUED: dashed faint.
          let stepBg: string;
          let stepBorder: string;
          let stageColor: string;
          let stepGlow = 'none';
          let stepBorderStyle: 'solid' | 'dashed' = 'solid';
          let stepOpacity = 1;

          if (active) {
            const glow = activeGlow(step);
            stepBg = 'transparent';
            stepBorder = glow;
            stageColor = glow;
            stepGlow = `0 0 18px -2px ${glow}, 0 0 4px -1px ${glow}`;
          } else if (done) {
            stepBg = 'var(--accent-tint-soft)';
            stepBorder = 'var(--accent-dim)';
            stageColor = 'var(--accent-dim)';
          } else {
            stepBg = 'transparent';
            stepBorder = 'var(--rule)';
            stageColor = 'var(--ink-dimmer)';
            stepBorderStyle = 'dashed';
            stepOpacity = 0.6;
          }

          // Agent identity color on the .who name regardless of state — eye
          // reads "this is gemini" before it reads "this is the active step."
          const whoColor = step.agentColor || (active ? activeGlow(step) : 'var(--ink-dim)');

          return (
            <Fragment key={step.key}>
              <div
                style={{
                  border: `1px ${stepBorderStyle} ${stepBorder}`,
                  padding: '14px 16px',
                  background: stepBg,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  boxShadow: stepGlow,
                  opacity: stepOpacity,
                  zIndex: active ? 2 : 1,
                  transition: 'background 0.2s, border-color 0.2s, box-shadow 0.25s',
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: stageColor,
                  }}
                >
                  [{String(i + 1).padStart(2, '0')}] {step.label}
                  {active ? ' · active' : done ? (
                    <>
                      {' · done '}
                      <span style={{ color: 'var(--accent-dim)' }}>✓</span>
                    </>
                  ) : ' · queued'}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 18,
                    fontWeight: 500,
                    color: whoColor,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {step.agent}
                </span>
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: done ? 'var(--accent-dim)' : active ? 'var(--accent)' : 'var(--rule-hot)',
                    fontSize: 14,
                    opacity: done || active ? 1 : 0.5,
                  }}
                >
                  ──▶
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}

/* ────────────────────────────── idea input ────────────────────────────── */

function IdeaInputPanel({
  state,
  slug,
  onSubmit,
}: {
  state: WarzoneState;
  slug: string | null;
  onSubmit: (idea: string) => void;
}) {
  const [input, setInput] = useState('');
  const disabled = state !== 'idle' && state !== 'awaiting_discuss_approval';

  const handleSubmit = () => {
    const text = input.trim();
    if (!text || disabled) return;
    onSubmit(text);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Panel
      headLabel={slug ? 'add round · same topic' : 'start a discussion'}
      headRight={disabled ? 'waiting for current round' : 'ready to submit'}
    >
      <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '18px 1fr',
            gap: 10,
            padding: 14,
            background: 'var(--bg-3)',
            border: '1px solid var(--rule)',
            alignItems: 'flex-start',
          }}
        >
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>$</span>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              slug
                ? `refine the idea for "${slug}"...`
                : 'what do you want to discuss? (e.g. build a real-time dashboard for argus)'
            }
            rows={3}
            disabled={disabled}
            style={{
              resize: 'none',
              fontSize: 13,
              lineHeight: 1.55,
              color: 'var(--ink)',
              width: '100%',
              opacity: disabled ? 0.5 : 1,
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <span
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              color: 'var(--ink-dimmer)',
              textTransform: 'uppercase',
            }}
          >
            ⏎ submit · ⇧⏎ newline
          </span>
          <ActionButton primary onClick={handleSubmit} disabled={disabled || !input.trim()}>
            {slug ? 'add round →' : 'start discussion →'}
          </ActionButton>
        </div>
      </div>
    </Panel>
  );
}

/* ────────────────────────────── approval panel ────────────────────────────── */

function ApprovalPanel({ onApprove, onAbort }: { onApprove: () => void; onAbort: () => void }) {
  return (
    <Panel headLabel="decision required" headRight="all three agents have weighed in">
      <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.5, maxWidth: '60ch' }}>
          approve to keep this discussion open — submit again to add another round on the same topic,
          or click <em style={{ color: 'var(--ink)', fontStyle: 'normal' }}>new discussion</em> in the hero to archive and switch topics.
        </p>
        <div style={{ display: 'flex', gap: 14, paddingTop: 8, borderTop: '1px dashed var(--rule)' }}>
          <ActionButton primary onClick={onApprove}>approve →</ActionButton>
          <div style={{ marginLeft: 'auto' }}>
            <ActionButton warn onClick={onAbort}>discard</ActionButton>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ────────────────────────────── output stream ────────────────────────────── */

function OutputStream({
  lines,
  droppedLineCount,
}: {
  lines: OutputLine[];
  droppedLineCount: number;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  if (lines.length === 0) return null;

  const total = lines.length + droppedLineCount;
  const agentColor = (a: string) => {
    const k = a.toLowerCase();
    if (k.includes('claude')) return 'var(--claude)';
    if (k.includes('gemini')) return 'var(--gemini)';
    if (k.includes('codex')) return 'var(--codex)';
    return 'var(--accent)';
  };

  return (
    <details style={{ border: '1px solid var(--rule)', background: 'var(--bg-2)' }}>
      <summary
        style={{
          padding: '12px 18px',
          borderBottom: '1px solid var(--rule)',
          fontSize: 10,
          letterSpacing: '0.16em',
          color: 'var(--ink-dimmer)',
          textTransform: 'uppercase',
          cursor: 'pointer',
          listStyle: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <span style={{ color: 'var(--accent)' }}>▸</span>
        raw output
        <span style={{ marginLeft: 'auto', color: 'var(--ink-dim)', letterSpacing: '0.08em' }}>
          {droppedLineCount > 0
            ? `last ${lines.length} of ${total} lines · ${droppedLineCount} dropped`
            : `${total} line${total === 1 ? '' : 's'}`}
        </span>
      </summary>
      <div
        style={{
          padding: '18px 22px',
          fontFamily: 'var(--font-body)',
          fontSize: 12.5,
          lineHeight: 1.65,
          maxHeight: 240,
          overflowY: 'auto',
        }}
      >
        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '72px 1fr',
              gap: 14,
              alignItems: 'baseline',
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.08em',
                color: agentColor(l.agent),
                textTransform: 'uppercase',
              }}
            >
              {l.agent}
            </span>
            <span style={{ color: 'var(--ink)' }}>{l.line}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </details>
  );
}

/* ────────────────────────────── explainer (idle, no slug) ────────────────────────────── */

function Explainer() {
  return (
    <Panel headLabel="how warzone works" headRight="sequential debate">
      <div
        style={{
          padding: '22px 26px',
          fontSize: 13,
          color: 'var(--ink-dim)',
          lineHeight: 1.7,
        }}
      >
        <ol style={{ paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li>
            <span style={{ color: 'var(--claude)', fontWeight: 500 }}>claude</span> frames the idea as planner and picks a slug for the topic
          </li>
          <li>
            <span style={{ color: 'var(--gemini)', fontWeight: 500 }}>gemini</span> proposes a build approach — stack, steps, concerns
          </li>
          <li>
            <span style={{ color: 'var(--codex)', fontWeight: 500 }}>codex</span> audits both takes and pokes holes
          </li>
          <li>You review the discussion and approve</li>
          <li>
            Submit again for another round on the same topic, or click <em style={{ color: 'var(--ink)', fontStyle: 'normal' }}>new discussion</em> to archive and start fresh
          </li>
        </ol>
      </div>
    </Panel>
  );
}

/* ────────────────────────────── main view ────────────────────────────── */

export function WarzoneView({
  state,
  idea,
  slug,
  lines,
  droppedLineCount,
  stageStartedAt,
  onSubmit,
  onApprove,
  onAbort,
  onNewDiscussion,
}: WarzoneViewProps) {
  const isIdle = state === 'idle';
  const busy =
    state === 'discussing_claude' ||
    state === 'discussing_gemini' ||
    state === 'discussing_codex';
  const showApproval = state === 'awaiting_discuss_approval';
  // New Discussion is only meaningful when there's a current discussion to archive AND
  // we're not mid-flight. The server enforces the same gate; this is UI affordance.
  const canStartNewDiscussion = !!slug && (state === 'idle' || showApproval);

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: '18px 24px 32px',
        background: 'var(--bg)',
        color: 'var(--ink)',
      }}
    >
      {/* Top row — idea input on the left, hero on the right. Same logic as
          the build view's top-row: the user's input is what they're hunting
          for ("where do I submit?"), put it where eyes land first. */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 18,
          alignItems: 'start',
        }}
      >
        <IdeaInputPanel state={state} slug={slug} onSubmit={onSubmit} />
        <HeroCard
          state={state}
          slug={slug}
          idea={idea}
          stageStartedAt={stageStartedAt}
          onNewDiscussion={onNewDiscussion}
          canStartNewDiscussion={canStartNewDiscussion}
        />
      </section>

      <PipelineStrip state={state} />

      {/* Three-column discussion (the star of this view). Only shown once we have
          something to display — hidden on first idle when no file exists yet. */}
      {!isIdle && (
        <div style={{ marginTop: 18 }}>
          <DiscussionReview state={state} />
        </div>
      )}

      {/* Idle + no prior discussion → show explainer to orient first-time users */}
      {isIdle && !slug && (
        <div style={{ marginTop: 18 }}>
          <Explainer />
        </div>
      )}

      {/* Approval panel appears below the 3-col view when all three agents are done */}
      {showApproval && (
        <div style={{ marginTop: 18 }}>
          <ApprovalPanel onApprove={onApprove} onAbort={onAbort} />
        </div>
      )}

      {/* Raw log — collapsible peek under the hood, only while busy. Defaults
          closed; debug affordance for when the discussion-review panel is
          empty and the user wants to see "what is the agent actually doing." */}
      {busy && lines.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <OutputStream lines={lines} droppedLineCount={droppedLineCount} />
        </div>
      )}
    </div>
  );
}
