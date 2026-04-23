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
  onSubmit: (idea: string) => void;
  onApprove: () => void;
  onAbort: () => void;
  onNewDiscussion: () => void;
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

/* ────────────────────────────── breadcrumbs ────────────────────────────── */

function Breadcrumbs({ slug }: { slug: string | null }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        paddingBottom: 14,
        borderBottom: '1px dashed var(--rule)',
        fontSize: 11,
        color: 'var(--ink-dimmer)',
        letterSpacing: '0.06em',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ color: 'var(--ink)' }}>work</span>
      <span style={{ color: 'var(--rule-hot)' }}>/</span>
      <span style={{ color: 'var(--accent)' }}>warzone</span>
      {slug && (
        <>
          <span style={{ color: 'var(--rule-hot)' }}>·</span>
          <span>
            discussion <span style={{ color: 'var(--ink)' }}>{slug}</span>
          </span>
        </>
      )}
      <span style={{ color: 'var(--ink-dim)', fontSize: 10, marginLeft: 'auto' }}>
        ws <b style={{ color: 'var(--accent)', fontWeight: 500 }}>3003</b> connected
      </span>
    </div>
  );
}

/* ────────────────────────────── hero card ────────────────────────────── */

function HeroCard({
  state,
  slug,
  idea,
  onNewDiscussion,
  canStartNewDiscussion,
}: {
  state: WarzoneState;
  slug: string | null;
  idea: string | null;
  onNewDiscussion: () => void;
  canStartNewDiscussion: boolean;
}) {
  const stateLabel =
    state === 'idle' ? 'ready' :
    state === 'awaiting_discuss_approval' ? 'awaiting review' :
    state.replace(/_/g, ' ');

  // Right column (flow + new-discussion button) shows whenever we have a slug,
  // regardless of whether there's a fresh idea. After approval, idea is cleared
  // but slug persists — and that's exactly when the user wants the button visible
  // to archive the current topic and start a new one.
  const showRightCol = !!slug || !!idea;

  return (
    <section
      style={{
        marginTop: 20,
        border: '1px solid var(--rule)',
        background: 'var(--bg-2)',
        display: 'grid',
        gridTemplateColumns: showRightCol ? '1fr auto' : '1fr',
        gap: 0,
      }}
    >
      <div style={{ padding: '22px 26px' }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.18em',
            color: 'var(--ink-dimmer)',
            textTransform: 'uppercase',
          }}
        >
          // discussion state: <b style={{ color: 'var(--accent)', fontWeight: 500 }}>{stateLabel}</b>
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px, 4.8vw, 56px)',
            fontWeight: 500,
            lineHeight: 1,
            letterSpacing: '-0.03em',
            marginTop: 10,
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
              marginTop: 16,
              fontSize: 13,
              color: 'var(--ink)',
              lineHeight: 1.55,
              maxWidth: '80ch',
            }}
          >
            <span style={{ color: 'var(--ink-dim)' }}>$ idea →</span> {idea}
          </p>
        )}
      </div>

      {showRightCol && (
        <div
          style={{
            borderLeft: '1px solid var(--rule)',
            padding: '22px 26px',
            minWidth: 220,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 14,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.14em',
                color: 'var(--ink-dimmer)',
                textTransform: 'uppercase',
              }}
            >
              flow
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 500,
                color: 'var(--ink)',
                marginTop: 4,
              }}
            >
              sequential
            </div>
          </div>
          <button
            onClick={onNewDiscussion}
            disabled={!canStartNewDiscussion}
            style={{
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: canStartNewDiscussion ? 'var(--ink)' : 'var(--ink-dimmer)',
              background: 'transparent',
              border: `1px solid ${canStartNewDiscussion ? 'var(--rule)' : 'var(--rule-hot)'}`,
              padding: '8px 12px',
              cursor: canStartNewDiscussion ? 'pointer' : 'not-allowed',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!canStartNewDiscussion) return;
              e.currentTarget.style.color = 'var(--accent)';
              e.currentTarget.style.borderColor = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              if (!canStartNewDiscussion) return;
              e.currentTarget.style.color = 'var(--ink)';
              e.currentTarget.style.borderColor = 'var(--rule)';
            }}
            title={
              !slug
                ? 'no active discussion to archive — submit one first'
                : !canStartNewDiscussion
                  ? 'wait for the current round to finish'
                  : 'archive this discussion and start a new topic'
            }
          >
            ↻ new discussion
          </button>
        </div>
      )}
    </section>
  );
}

/* ────────────────────────────── pipeline strip ────────────────────────────── */

function PipelineStrip({ state }: { state: WarzoneState }) {
  const currentIdx = stateIndex(state);
  return (
    <section
      style={{
        marginTop: 18,
        border: '1px solid var(--rule)',
        background: 'var(--bg-2)',
        padding: '22px 26px',
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
          marginBottom: 18,
        }}
      >
        <span style={{ color: 'var(--rule-hot)', letterSpacing: 0 }}>┌──</span>
        sequence · claude → gemini → codex → review
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr auto 1fr auto 1fr',
          gap: 12,
          alignItems: 'stretch',
        }}
      >
        {PIPELINE_STEPS.map((step, i) => {
          const stepIdx = STATE_ORDER.indexOf(step.matchStates[0]);
          const done = currentIdx > stepIdx;
          const active = step.matchStates.includes(state);

          const borderColor = active ? 'var(--accent)' : done ? 'var(--accent-dim)' : 'var(--rule-hot)';
          const background = active
            ? 'rgba(196,255,61,0.08)'
            : done
              ? 'rgba(196,255,61,0.03)'
              : 'var(--bg-3)';
          const stageColor = active ? 'var(--accent)' : done ? 'var(--accent-dim)' : 'var(--ink-dimmer)';
          const whoColor = step.agentColor
            ? active
              ? step.agentColor
              : done
                ? 'var(--ink)'
                : 'var(--ink-dim)'
            : active
              ? 'var(--accent)'
              : done
                ? 'var(--ink)'
                : 'var(--ink-dim)';

          return (
            <Fragment key={step.key}>
              <div
                style={{
                  border: `1px solid ${borderColor}`,
                  boxShadow: active ? 'inset 0 0 0 1px var(--accent)' : 'none',
                  padding: '14px 16px',
                  background,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
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
                  {active ? ' · active' : done ? ' · done' : ' · queued'}
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
                    color: active || done ? 'var(--accent)' : 'var(--rule-hot)',
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
      <Breadcrumbs slug={slug} />

      <HeroCard
        state={state}
        slug={slug}
        idea={idea}
        onNewDiscussion={onNewDiscussion}
        canStartNewDiscussion={canStartNewDiscussion}
      />

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

      {/* Raw log — collapsible peek under the hood, only while busy */}
      {busy && lines.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <OutputStream lines={lines} droppedLineCount={droppedLineCount} />
        </div>
      )}

      {/* Idea input — always at the bottom when user can act */}
      <div style={{ marginTop: 18 }}>
        <IdeaInputPanel state={state} slug={slug} onSubmit={onSubmit} />
      </div>
    </div>
  );
}
