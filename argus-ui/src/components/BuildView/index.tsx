import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { BuildState, OutputLine } from '../../types';
import { FileBrowser } from './FileBrowser';
import { InlinePreview } from './InlinePreview';
import { Panel, ActionButton } from '../shared/Panel';
import { markdownComponents } from '../shared/markdownComponents';
import { SERVERS, authHeaders } from '../../config';

type ViewMode = 'pipeline' | 'workspace';

interface BuildViewProps {
  state: BuildState;
  task: string | null;
  iteration: number;
  grade?: string;
  slug: string | null;
  autoApprove: boolean;
  autoApproveCap: number;
  stageStartedAt: number;
  lines: OutputLine[];
  droppedLineCount: number;
  projects: string[];
  onSubmit: (description: string, opts?: { mode: 'new' | 'continue'; slug?: string; autoApprove?: boolean; autoApproveCap?: number; planReview?: boolean }) => void;
  onApprove: () => void;
  onSkip: () => void;
  onRetry: () => void;
  onAbort: () => void;
  onApprovePlan: () => void;
  onRequestPlanChanges: (feedback: string) => void;
  onStop: () => void;
}

/* ────────────────────────────── constants ────────────────────────────── */

// Per-stage expected durations — pulled from the 16-task baseline, rounded to cleaner
// round numbers. They're a reference bar in the UI, not a deadline.
const STAGE_CONFIG: Partial<Record<BuildState, { agent: string; agentColor: string; description: string; expectedSec: number }>> = {
  planning: {
    agent: 'claude',
    agentColor: 'var(--claude)',
    description: 'writing the plan that gemini will build from',
    expectedSec: 180,
  },
  building: {
    agent: 'gemini',
    agentColor: 'var(--gemini)',
    description: 'creating files from the plan',
    expectedSec: 180,
  },
  auditing: {
    agent: 'codex',
    agentColor: 'var(--codex)',
    description: 'reviewing the build for correctness',
    expectedSec: 180,
  },
};

const PIPELINE_STEPS: { key: string; label: string; agent: string; agentColor: string | null; matchStates: BuildState[] }[] = [
  { key: 'plan',   label: 'plan',   agent: 'claude', agentColor: 'var(--claude)', matchStates: ['planning'] },
  { key: 'build',  label: 'build',  agent: 'gemini', agentColor: 'var(--gemini)', matchStates: ['building'] },
  { key: 'audit',  label: 'audit',  agent: 'codex',  agentColor: 'var(--codex)',  matchStates: ['auditing'] },
  { key: 'review', label: 'review', agent: 'you',    agentColor: null,            matchStates: ['awaiting_approval'] },
  { key: 'done',   label: 'done',   agent: 'hermes', agentColor: null,            matchStates: ['done'] },
];

// Linear state order used to decide which pipeline steps are "done" vs "queued"
// relative to a given state. `paused` is treated as still-in-build for display.
const STATE_ORDER: BuildState[] = [
  'idle',
  'planning',
  'building',
  'auditing',
  'awaiting_approval',
  'paused',
  'done',
];

/* ────────────────────────────── helpers ────────────────────────────── */

// Format a millisecond duration as "Xm YYs" (or "Ys" under one minute).
// Used by the hero's inline elapsed counter so the user sees "yes the build
// is still making progress" without staring at an unmoving panel.
function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

function stateIndex(s: BuildState): number {
  const i = STATE_ORDER.indexOf(s);
  return i < 0 ? 0 : i;
}

/* ───────────────────── stop pipeline (inline) ───────────────────── */

// Right-aligned stop button that lives between the hero card and pipeline
// strip while a build is in flight. Was in the sidebar footer originally —
// users routinely missed it because the bottom-left corner is invisible
// during focused work. Lime fill + ■ glyph match the visual language of
// the previous sidebar button, so users who knew the old one still
// recognize it.
function StopPipelineButton({ state, onStop }: { state: BuildState; onStop: () => void }) {
  const busy = state !== 'idle' && state !== 'done';
  if (!busy) return null;
  return (
    <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
      <button
        onClick={onStop}
        style={{
          padding: '8px 16px',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--accent-ink)',
          background: 'var(--accent)',
          border: 'none',
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent)')}
      >
        ■ stop pipeline
      </button>
    </div>
  );
}

/* ────────────────────────────── top controls ────────────────────────────── */

// Slim chrome row above the hero. Holds only the view-mode toggle, right-aligned.
// The breadcrumb trail (work / build · slug · ws) was removed: section is shown
// in the sidebar's active item, slug is the giant pill in the hero, and ws state
// is implementation noise the user can't act on.
function TopControls({
  viewMode,
  onViewModeChange,
}: {
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        paddingBottom: 4,
      }}
    >
      <ViewModeToggle value={viewMode} onChange={onViewModeChange} />
    </div>
  );
}

// Segmented control that flips the Build view between the pipeline cockpit and
// the workspace split-pane (file tree + inline preview). State is local to the
// view — no persistence across tab switches.
function ViewModeToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  const button = (mode: ViewMode, label: string, icon: string) => {
    const active = value === mode;
    return (
      <button
        onClick={() => onChange(mode)}
        style={{
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: active ? 'var(--accent-ink)' : 'var(--ink-dim)',
          background: active ? 'var(--accent)' : 'transparent',
          padding: '4px 10px',
          border: '1px solid var(--rule)',
          borderColor: active ? 'var(--accent)' : 'var(--rule)',
          cursor: 'pointer',
          transition: 'color 0.15s, background 0.15s, border-color 0.15s',
          fontWeight: active ? 600 : 400,
        }}
        onMouseEnter={(e) => {
          if (active) return;
          e.currentTarget.style.color = 'var(--ink)';
          e.currentTarget.style.borderColor = 'var(--ink-dim)';
        }}
        onMouseLeave={(e) => {
          if (active) return;
          e.currentTarget.style.color = 'var(--ink-dim)';
          e.currentTarget.style.borderColor = 'var(--rule)';
        }}
      >
        {icon} {label}
      </button>
    );
  };
  return (
    <div style={{ display: 'flex', gap: 0, marginLeft: 'auto' }}>
      {button('pipeline', 'pipeline', '▸')}
      {button('workspace', 'workspace', '◧')}
    </div>
  );
}

/* ────────────────────────────── hero card ────────────────────────────── */

// Hero is now the "where am I + what's the pipeline doing" anchor. Two-column:
//   left  — slug pill + task description + (when an agent is running) the
//           inline active-stage line "agent is working" with its meta dot
//   right — pipeline-state tag + nested last-audit panel
// The right rail of iteration / mode / watcher was removed (iteration lives in
// the pipeline header, mode is implicit in the slug, watcher is implementation).
function HeroCard({
  state,
  slug,
  task,
  iteration,
  grade,
  stageStartedAt,
}: {
  state: BuildState;
  slug: string | null;
  task: string | null;
  iteration: number;
  grade?: string;
  stageStartedAt: number;
}) {
  // Live elapsed counter — re-renders the hero once per second while an agent
  // is running so the user sees the build is making progress. Only ticks for
  // working states; idle/done/awaiting cleanly stops the interval.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!['planning', 'building', 'auditing'].includes(state)) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state]);

  const stateLabel =
    state === 'idle' ? 'ready' :
    state === 'done' ? 'complete' :
    state === 'paused' ? 'paused' :
    state === 'awaiting_approval' ? 'awaiting review' :
    state === 'awaiting_plan_review' ? 'awaiting plan review' :
    state;

  // STAGE_CONFIG holds the working-state agent + description; pull the active
  // entry to render the "agent is working" line inline. Decision/idle/done
  // states fall through to no inline activity (the action panel below handles
  // those flows).
  const stageCfg = STAGE_CONFIG[state];

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
      {/* Left column — slug + task + (running) agent-status block */}
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
            <span style={{ color: 'var(--ink-dimmer)' }}>no active build</span>
          )}
        </h1>
        {task && (
          <p
            style={{
              marginTop: 14,
              fontSize: 13,
              color: 'var(--ink)',
              lineHeight: 1.55,
              maxWidth: '80ch',
            }}
          >
            <span style={{ color: 'var(--ink-dim)' }}>$ task →</span> {task}
          </p>
        )}

        {/* Inline active-stage block — replaces the standalone Active Stage panel
            for the working states (planning/building/auditing). Decision states
            (awaiting_approval/paused/awaiting_plan_review) get a separate panel
            below the pipeline strip; this section only renders the "agent is
            working" headline. */}
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
              <span style={{ color: 'var(--ink)' }}>is working</span>
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 36,
                fontWeight: 500,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '-0.02em',
                color: 'var(--warn)',
                lineHeight: 1,
                marginTop: 4,
              }}
            >
              {formatElapsed(now - stageStartedAt)}
            </div>
          </div>
        )}
      </div>

      {/* Right column — pipeline state tag (top) + nested last-audit panel.
          Width fixed at 260px so the left column gets enough room for the slug
          pill + task description. */}
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
        <span
          style={{
            alignSelf: 'flex-end',
            fontSize: 10,
            letterSpacing: '0.18em',
            color: 'var(--ink-dimmer)',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          // pipeline state: <b style={{ color: 'var(--accent)', fontWeight: 500 }}>{stateLabel}</b>
        </span>
        <HeroAuditPanel grade={grade} iteration={iteration} />
      </div>
    </section>
  );
}

// Compact last-audit nested panel. Same data as the (now-deleted) standalone
// LastAudit, sized down (56px grade vs 84px) so it fits the 260px hero column.
function HeroAuditPanel({ grade, iteration }: { grade?: string; iteration: number }) {
  return (
    <Panel
      headLabel="last audit"
      headRight={grade ? `iter ${iteration} · codex` : 'no audit yet'}
    >
      <div
        style={{
          padding: '14px 16px',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: 16,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 56,
            fontWeight: 500,
            lineHeight: 0.8,
            letterSpacing: '-0.06em',
            color: grade === 'A' ? 'var(--accent)' : grade ? 'var(--ink)' : 'var(--ink-dimmer)',
          }}
        >
          {grade ?? '—'}
        </div>
        <div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.14em',
              color: 'var(--ink-dimmer)',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            grade
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink)', marginBottom: 8 }}>
            {grade === 'A'
              ? 'A · no revisions requested'
              : grade
                ? `${grade} · codex flagged issues`
                : 'audit runs after build-log.md'}
          </div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.14em',
              color: 'var(--ink-dimmer)',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            iteration
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-dim)' }}>
            {iteration > 0 ? iteration : '—'}
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ────────────────────────────── pipeline strip ────────────────────────────── */

// Glow color when a step is active. claude/gemini/codex use their identity
// colors (already on the step.agentColor field). "review" is human-driven, so
// uses warn (red) to read as "your turn"; "done" is hermes archiving, lime.
function activeGlow(step: typeof PIPELINE_STEPS[number]): string {
  if (step.agentColor) return step.agentColor;
  if (step.key === 'review') return 'var(--warn)';
  return 'var(--accent)';
}

function PipelineStrip({ state, iteration }: { state: BuildState; iteration: number }) {
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
      {/* Header — pipeline label left, iteration N right. The iter-N marker
          relocated here from the (deleted) Active Stage panel head. */}
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
        pipeline · plan → build → audit → review → done
        <span style={{ marginLeft: 'auto', color: 'var(--ink-dim)' }}>
          iteration{' '}
          <b style={{ color: 'var(--ink)', fontWeight: 500 }}>
            {iteration > 0 ? iteration : '—'}
          </b>
        </span>
      </div>

      {/* Strip — boxes carry agent identity. ACTIVE: transparent bg + agent-color
          border + outer glow in agent color (claude orange / gemini blue / codex
          purple / you red / hermes lime). DONE: sunken accent-tint-soft + ✓.
          QUEUED: dashed faint outline. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: PIPELINE_STEPS.map((step) =>
            (step.matchStates.includes(state) ||
              (state === 'paused' && step.key === 'build'))
              ? '1.25fr auto'
              : '1fr auto'
          )
            .join(' ')
            .replace(/auto$/, ''),
          gap: 6,
          alignItems: 'stretch',
        }}
      >
        {PIPELINE_STEPS.map((step, i) => {
          const stepFirstMatchIdx = STATE_ORDER.indexOf(step.matchStates[0]);
          const done = currentIdx > stepFirstMatchIdx;
          const active =
            step.matchStates.includes(state) ||
            (state === 'paused' && step.key === 'build');

          // ACTIVE styling now uses the agent's identity color for border, glow,
          // stage label, and the agent name itself. Background stays transparent
          // so the colored glow + colored border do the visual work without
          // burying agent identity under a solid lime fill.
          let stepBg: string;
          let stepBorder: string;
          let stageColor: string;
          let whoColor: string;
          let stepGlow = 'none';
          let stageOpacity = 1;

          if (active) {
            const glow = activeGlow(step);
            stepBg = 'transparent';
            stepBorder = glow;
            stageColor = glow;
            whoColor = glow;
            stepGlow = `0 0 18px -2px ${glow}, 0 0 4px -1px ${glow}`;
          } else if (done) {
            stepBg = 'var(--accent-tint-soft)';
            stepBorder = 'var(--accent-dim)';
            stageColor = 'var(--accent-dim)';
            whoColor = step.agentColor || 'var(--ink)';
          } else {
            stepBg = 'transparent';
            stepBorder = 'var(--rule)';
            stageColor = 'var(--ink-dimmer)';
            whoColor = step.agentColor || 'var(--ink-dim)';
            stageOpacity = 0.6;
          }

          return (
            <Fragment key={step.key}>
              <div
                style={{
                  border: `1px ${active || done ? 'solid' : 'dashed'} ${stepBorder}`,
                  padding: '7px 11px',
                  background: stepBg,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  boxShadow: stepGlow,
                  zIndex: active ? 2 : 1,
                  opacity: stageOpacity,
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
                    fontSize: 16,
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

/* AgentMonitor removed — its info (per-agent state) is now read from the
   pipeline strip with agent-color identity styling. The 3-agent panel is
   redundant when the strip already shows claude / gemini / codex with their
   identity colors and active/done/queued state. */

/* ────────────────────────────── active stage ────────────────────────────── */

// ActionPanel — renders only for states that need user action or carry a
// distinct sealed-state read (decision required / paused / plan review /
// done / idle). Working states (planning/building/auditing) return null
// because the hero card now shows the inline "agent is working" line.
function ActionPanel({
  state,
  iteration,
  grade,
  slug,
  autoApprove,
  autoApproveCap,
  onApprove,
  onSkip,
  onRetry,
  onAbort,
  onApprovePlan,
  onRequestPlanChanges,
}: {
  state: BuildState;
  iteration: number;
  grade?: string;
  slug: string | null;
  autoApprove: boolean;
  autoApproveCap: number;
  onApprove: () => void;
  onSkip: () => void;
  onRetry: () => void;
  onAbort: () => void;
  onApprovePlan: () => void;
  onRequestPlanChanges: (feedback: string) => void;
}) {
  if (state === 'awaiting_plan_review') {
    return <PlanReviewPanel slug={slug} onApprove={onApprovePlan} onRequestChanges={onRequestPlanChanges} onAbort={onAbort} />;
  }

  if (state === 'awaiting_approval') {
    // Two display modes for awaiting_approval:
    // - Auto-mode is engaged AND we haven't hit the cap yet → "auto-approving" panel
    // - Auto-mode is off (either never enabled, or disabled by cap-hit) → standard
    //   decision UI. If cap-hit caused the disable, show the release notice.
    const inAutoLoop = autoApprove && iteration < autoApproveCap;
    const capReleased = !autoApprove && autoApproveCap > 0 && iteration >= autoApproveCap;

    if (inAutoLoop) {
      return (
        <Panel
          headLabel="auto-approving"
          headRight={`iter ${iteration} of ${autoApproveCap} · codex flagged ${grade ?? '?'}`}
        >
          <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 64,
                  fontWeight: 500,
                  lineHeight: 0.8,
                  letterSpacing: '-0.06em',
                  color: grade === 'F' ? 'var(--warn)' : grade === 'A' ? 'var(--accent)' : 'var(--ink)',
                }}
              >
                {grade ?? '—'}
              </span>
              <div style={{ fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.5, maxWidth: '52ch' }}>
                auto-approving revision {iteration} of {autoApproveCap}. abort any time if this isn't going where you want.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 14, paddingTop: 8, borderTop: '1px dashed var(--rule)' }}>
              <ActionButton warn onClick={onAbort}>abort</ActionButton>
            </div>
          </div>
        </Panel>
      );
    }

    return (
      <Panel headLabel="decision required" headRight={`iteration ${iteration} · codex flagged ${grade ?? '?'}`}>
        <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {capReleased && (
            <div
              style={{
                fontSize: 11,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--warn)',
                padding: '6px 10px',
                border: '1px dashed var(--warn)',
              }}
            >
              auto-mode released — reached iteration {autoApproveCap} cap
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 84,
                fontWeight: 500,
                lineHeight: 0.8,
                letterSpacing: '-0.06em',
                color: grade === 'A' ? 'var(--accent)' : grade === 'B' ? 'var(--ink)' : 'var(--warn)',
              }}
            >
              {grade ?? '—'}
            </span>
            <div style={{ fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.5, maxWidth: '52ch' }}>
              codex flagged issues. revise to let gemini take another pass from the same plan + feedback, or skip to accept this grade and move on.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, paddingTop: 8, borderTop: '1px dashed var(--rule)' }}>
            <ActionButton primary onClick={onApprove}>revise →</ActionButton>
            <ActionButton onClick={onSkip}>skip</ActionButton>
            <div style={{ marginLeft: 'auto' }}>
              <ActionButton warn onClick={onAbort}>abort</ActionButton>
            </div>
          </div>
        </div>
      </Panel>
    );
  }

  if (state === 'paused') {
    return (
      <Panel headLabel="paused after retry" headRight="agent failed twice">
        <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.5, maxWidth: '60ch' }}>
            an agent failed twice in a row. retry to run the failed stage again, or abort to reset the pipeline.
          </p>
          <div style={{ display: 'flex', gap: 14 }}>
            <ActionButton primary onClick={onRetry}>retry →</ActionButton>
            <ActionButton warn onClick={onAbort}>abort</ActionButton>
          </div>
        </div>
      </Panel>
    );
  }

  if (state === 'done') {
    return (
      <Panel headLabel="pipeline complete" headRight={`iteration ${iteration || 1} · sealed`}>
        <div style={{ padding: '22px 26px', display: 'flex', alignItems: 'baseline', gap: 20 }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 84,
              fontWeight: 500,
              lineHeight: 0.8,
              letterSpacing: '-0.06em',
              color: grade === 'A' ? 'var(--accent)' : 'var(--ink)',
            }}
          >
            {grade ?? '—'}
          </span>
          <div style={{ fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.5 }}>
            build complete. submit a new task below to continue.
          </div>
        </div>
      </Panel>
    );
  }

  if (state === 'idle') {
    return (
      <Panel headLabel="ready" headRight="pipeline idle">
        <div style={{ padding: '22px 26px', fontSize: 13, color: 'var(--ink-dim)', lineHeight: 1.5 }}>
          submit a task below to start the build pipeline. claude plans, gemini builds, codex audits.
        </div>
      </Panel>
    );
  }

  // Working states (planning/building/auditing) — no action panel needed,
  // the hero card already shows the "<agent> is working" inline block.
  return null;
}

/* ────────────────────────────── plan review ────────────────────────────── */

function PlanReviewPanel({
  slug,
  onApprove,
  onRequestChanges,
  onAbort,
}: {
  slug: string | null;
  onApprove: () => void;
  onRequestChanges: (feedback: string) => void;
  onAbort: () => void;
}) {
  const [planContent, setPlanContent] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [feedback, setFeedback] = useState('');

  // Fetch the plan from disk via the existing /files/content endpoint. Re-fetch
  // when slug changes (continuation flows). Only fires when slug is non-null —
  // before slug is set we have nothing to display anyway.
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setPlanContent(null);
    setLoadError(null);
    fetch(
      `${SERVERS.build.http}/files/content?path=${encodeURIComponent(`${slug}-Plan.md`)}`,
      { headers: authHeaders() },
    )
      .then(async (res) => {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(body.error || `HTTP ${res.status}`);
        } else if (typeof body.content === 'string') {
          setPlanContent(body.content);
        } else {
          setLoadError('plan file is binary or unreadable');
        }
      })
      .catch((e) => {
        if (!cancelled) setLoadError((e as Error).message);
      });
    return () => { cancelled = true; };
  }, [slug]);

  const submitFeedback = () => {
    const trimmed = feedback.trim();
    if (!trimmed) return;
    onRequestChanges(trimmed);
    setFeedback('');
    setRequestingChanges(false);
  };

  return (
    <Panel headLabel="plan ready" headRight={`awaiting your review${slug ? ` · ${slug}` : ''}`}>
      <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Header row — view toggle */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--ink-dimmer)', textTransform: 'uppercase' }}>
            view:
          </span>
          <button
            onClick={() => setShowRaw(false)}
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              padding: '4px 10px',
              border: '1px solid var(--rule)',
              background: !showRaw ? 'var(--accent)' : 'transparent',
              color: !showRaw ? 'var(--accent-ink)' : 'var(--ink-dim)',
              cursor: 'pointer',
            }}
          >
            ▸ rendered
          </button>
          <button
            onClick={() => setShowRaw(true)}
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              padding: '4px 10px',
              border: '1px solid var(--rule)',
              background: showRaw ? 'var(--accent)' : 'transparent',
              color: showRaw ? 'var(--accent-ink)' : 'var(--ink-dim)',
              cursor: 'pointer',
            }}
          >
            ◧ raw
          </button>
        </div>

        {/* Plan content */}
        <div
          style={{
            padding: '14px 16px',
            background: 'var(--bg-3)',
            border: '1px solid var(--rule)',
            maxHeight: 480,
            overflowY: 'auto',
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          {loadError && (
            <div style={{ color: 'var(--warn)', fontSize: 12 }}>
              could not load plan: {loadError}
            </div>
          )}
          {!loadError && planContent === null && (
            <div style={{ color: 'var(--ink-dim)', fontSize: 12 }}>loading plan…</div>
          )}
          {!loadError && planContent !== null && (
            showRaw ? (
              <pre style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--ink)' }}>
                {planContent}
              </pre>
            ) : (
              <div className="markdown-body" style={{ color: 'var(--ink)' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {planContent}
                </ReactMarkdown>
              </div>
            )
          )}
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', gap: 14, paddingTop: 8, borderTop: '1px dashed var(--rule)', alignItems: 'center' }}>
          <ActionButton primary onClick={onApprove}>approve plan →</ActionButton>
          <ActionButton onClick={() => setRequestingChanges((v) => !v)}>
            {requestingChanges ? 'cancel changes' : 'request changes ▾'}
          </ActionButton>
          <div style={{ marginLeft: 'auto' }}>
            <ActionButton warn onClick={onAbort}>abort</ActionButton>
          </div>
        </div>

        {/* Request-changes textarea */}
        {requestingChanges && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
            <span style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--ink-dimmer)', textTransform: 'uppercase' }}>
              what should change about the plan?
            </span>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
              placeholder="e.g. use Next.js 14 not 15. add a /shared folder for reusable components."
              style={{
                resize: 'vertical',
                fontSize: 13,
                lineHeight: 1.5,
                color: 'var(--ink)',
                background: 'var(--bg-3)',
                border: '1px solid var(--rule)',
                padding: '10px 12px',
                width: '100%',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--ink-dimmer)', textTransform: 'uppercase' }}>
                {feedback.trim().length} / 4096 chars
              </span>
              <ActionButton primary onClick={submitFeedback}>
                send to claude →
              </ActionButton>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

/* ────────────────────────────── output stream ────────────────────────────── */

function OutputStream({ lines, droppedLineCount }: { lines: OutputLine[]; droppedLineCount: number }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Auto-follow only when the user is already near the bottom of the log panel.
    // Keeps the outer BuildView scroll position untouched (block: 'nearest') so
    // reading the hero doesn't yank the page back down on every new line.
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (nearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [lines]);

  const total = lines.length + droppedLineCount;
  const agentColor = (a: string) => {
    const k = a.toLowerCase();
    if (k.includes('claude')) return 'var(--claude)';
    if (k.includes('gemini')) return 'var(--gemini)';
    if (k.includes('codex')) return 'var(--codex)';
    return 'var(--accent)';
  };

  return (
    <Panel
      headLabel="output stream"
      headRight={
        droppedLineCount > 0
          ? `last ${lines.length} of ${total} lines · ${droppedLineCount} dropped`
          : `${total} line${total === 1 ? '' : 's'}`
      }
    >
      <div
        ref={scrollRef}
        style={{
          padding: '18px 22px',
          fontFamily: 'var(--font-body)',
          fontSize: 12.5,
          lineHeight: 1.65,
          maxHeight: 320,
          overflowY: 'auto',
        }}
      >
        {lines.length === 0 ? (
          <p style={{ color: 'var(--ink-dimmer)' }}>output will appear here once an agent starts streaming.</p>
        ) : (
          lines.map((l, i) => (
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
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <div
        style={{
          padding: '10px 22px',
          borderTop: '1px dashed var(--rule)',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: 'var(--ink-dimmer)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        <span style={{ color: lines.length > 0 ? 'var(--accent)' : 'var(--ink-dimmer)' }}>
          {lines.length > 0 && (
            <span style={{ animation: 'blink 1.2s steps(1) infinite', marginRight: 6 }}>●</span>
          )}
          {lines.length > 0 ? 'live · streaming' : 'idle'}
        </span>
      </div>
    </Panel>
  );
}

/* ────────────────────────────── task input ────────────────────────────── */

function TaskInputPanel({
  state,
  projects,
  onSubmit,
}: {
  state: BuildState;
  projects: string[];
  onSubmit: (description: string, opts?: { mode: 'new' | 'continue'; slug?: string; autoApprove?: boolean; autoApproveCap?: number; planReview?: boolean }) => void;
}) {
  const [input, setInput] = useState('');
  const [projectSel, setProjectSel] = useState<string>('new');
  const [autoOn, setAutoOn] = useState(false);
  // Empty string means "use the server default of 10". Stored as string to allow
  // the user to clear the field; parsed to int only at submit time.
  const [capInput, setCapInput] = useState<string>('');
  const [planReviewOn, setPlanReviewOn] = useState(false);
  const effectiveSel = projectSel !== 'new' && !projects.includes(projectSel) ? 'new' : projectSel;
  const continueSlug = effectiveSel === 'new' ? null : effectiveSel;
  const disabled = state !== 'idle' && state !== 'done';

  const handleSubmit = () => {
    const text = input.trim();
    if (!text || disabled) return;
    const opts: { mode: 'new' | 'continue'; slug?: string; autoApprove?: boolean; autoApproveCap?: number; planReview?: boolean } =
      continueSlug ? { mode: 'continue', slug: continueSlug } : { mode: 'new' };
    if (autoOn) {
      opts.autoApprove = true;
      const parsed = parseInt(capInput.trim(), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        opts.autoApproveCap = parsed;
      }
    }
    if (planReviewOn) {
      opts.planReview = true;
    }
    onSubmit(text, opts);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Panel headLabel="task queue" headRight={disabled ? 'runs after current build' : 'ready to submit'}>
      <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Project + Auto-Approve + Review-Plan packed in one row, with the
            project selector on the left and toggle pills following. flex-wrap
            lets the pills drop to a second line at narrow widths. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <label
            htmlFor="proj-sel"
            style={{
              fontSize: 10,
              letterSpacing: '0.14em',
              color: 'var(--ink-dimmer)',
              textTransform: 'uppercase',
            }}
          >
            project
          </label>
          <select
            id="proj-sel"
            value={effectiveSel}
            onChange={(e) => setProjectSel(e.target.value)}
            style={{
              fontSize: 12,
              color: 'var(--ink)',
              background: 'var(--bg-3)',
              padding: '6px 10px',
              border: '1px solid var(--rule)',
            }}
          >
            <option value="new">new project</option>
            {projects.map((slug) => (
              <option key={slug} value={slug}>
                continue: {slug}
              </option>
            ))}
          </select>
          {/* Review-Plan first so the optional `cap` input stays adjacent to
              its owning Auto-Approve toggle (cap only renders when autoOn). */}
          <TogglePill
            on={planReviewOn}
            disabled={disabled}
            onChange={setPlanReviewOn}
            label="Review-Plan"
          />
          <TogglePill
            on={autoOn}
            disabled={disabled}
            onChange={setAutoOn}
            label="Auto-Approve"
          />
          {autoOn && (
            <input
              aria-label="max auto-approve iterations"
              type="number"
              min={1}
              max={20}
              placeholder="cap 10"
              value={capInput}
              onChange={(e) => setCapInput(e.target.value)}
              disabled={disabled}
              style={{
                width: 70,
                fontSize: 11,
                color: 'var(--ink)',
                background: 'var(--bg-3)',
                padding: '5px 8px',
                border: '1px solid var(--rule)',
              }}
            />
          )}
        </div>
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
              continueSlug
                ? `describe the next change for ${continueSlug}...`
                : 'describe what you want to build...'
            }
            rows={6}
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
            {continueSlug ? 'continue build →' : 'start build →'}
          </ActionButton>
        </div>
      </div>
    </Panel>
  );
}

// Toggle pill — replaces the native checkbox for the terminal aesthetic.
// Off: rule border, ink-dim text. On: lime border + accent-tint fill +
// solid lime indicator dot. Sized to sit inline with the project select.
function TogglePill({
  on,
  disabled,
  onChange,
  label,
}: {
  on: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 12px',
        border: `1px solid ${on ? 'var(--accent)' : 'var(--rule)'}`,
        background: on ? 'var(--accent-tint)' : 'var(--bg-3)',
        color: on ? 'var(--accent)' : 'var(--ink-dim)',
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'color 0.15s, border-color 0.15s, background 0.15s',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          border: `1px solid ${on ? 'var(--accent)' : 'var(--ink-dimmer)'}`,
          background: on ? 'var(--accent)' : 'transparent',
          flexShrink: 0,
          transition: 'background 0.15s, border-color 0.15s',
        }}
      />
      {label}
    </button>
  );
}

/* LastAudit relocated into HeroAuditPanel inside the hero card.
   TaskMeta dropped — slug lives in the hero, iteration in the pipeline header,
   signals are the pipeline strip itself, subject + durability are
   implementation noise the user can't act on. */

/* ────────────────────────────── main view ────────────────────────────── */

export function BuildView({
  state,
  task,
  iteration,
  grade,
  slug,
  autoApprove,
  autoApproveCap,
  stageStartedAt,
  lines,
  droppedLineCount,
  projects,
  onSubmit,
  onApprove,
  onSkip,
  onRetry,
  onAbort,
  onApprovePlan,
  onRequestPlanChanges,
  onStop,
}: BuildViewProps) {
  // View mode toggle: pipeline (cockpit) vs workspace (file tree + preview split pane).
  // Local state — doesn't persist across tab switches. Selection lives here too so the
  // inline preview can render the clicked file.
  const [viewMode, setViewMode] = useState<ViewMode>('pipeline');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  if (viewMode === 'workspace') {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '18px 24px 24px',
          background: 'var(--bg)',
          color: 'var(--ink)',
          minHeight: 0,
        }}
      >
        <TopControls viewMode={viewMode} onViewModeChange={setViewMode} />

        {/* Compact state strip so the user still sees pipeline progress while browsing files */}
        <div style={{ marginTop: 14, flexShrink: 0 }}>
          <PipelineStrip state={state} iteration={iteration} />
        </div>

        {/* Split pane: file tree on left, inline preview on right. The file
            browser owns its own header (filter / sort / pin), so the previous
            <Panel fill headLabel="files"> wrapper is gone — the panel chrome
            it provided was redundant with the new FileBrowser header. */}
        <section
          style={{
            marginTop: 18,
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: '340px 1fr',
            gap: 14,
          }}
        >
          <div
            style={{
              border: '1px solid var(--rule)',
              background: 'var(--bg-2)',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <FileBrowser
              onFileSelect={setSelectedFile}
              externalSelectedFile={selectedFile}
              activeSlug={slug}
            />
          </div>
          <InlinePreview path={selectedFile} />
        </section>
      </div>
    );
  }

  // Pipeline mode — task queue and hero share the top row so the input is
  // visible immediately on page load (no scrolling past the pipeline + output
  // to find where to submit a task). Hero contains slug + task + inline
  // active-stage block + last-audit panel. Pipeline strip below. Action panel
  // (decision/paused/plan-review) only renders when a state needs the user.
  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: '14px 24px 32px',
        background: 'var(--bg)',
        color: 'var(--ink)',
      }}
    >
      <TopControls viewMode={viewMode} onViewModeChange={setViewMode} />

      <section
        style={{
          marginTop: 14,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 18,
          alignItems: 'start',
        }}
      >
        <TaskInputPanel state={state} projects={projects} onSubmit={onSubmit} />
        <HeroCard
          state={state}
          slug={slug}
          task={task}
          iteration={iteration}
          grade={grade}
          stageStartedAt={stageStartedAt}
        />
      </section>

      {/* Stop control — only shown while a build is in flight. Lives in the
          gap between hero and pipeline so the user finds it inline with the
          active stage they're already looking at, instead of hunting in the
          sidebar's bottom-left corner. */}
      <StopPipelineButton state={state} onStop={onStop} />

      <PipelineStrip state={state} iteration={iteration} />

      {/* ActionPanel renders null for working/idle/done states (hero handles
          those). Renders an action panel for awaiting_plan_review,
          awaiting_approval, and paused so the user can act. */}
      <div style={{ marginTop: 18 }}>
        <ActionPanel
          state={state}
          iteration={iteration}
          grade={grade}
          slug={slug}
          autoApprove={autoApprove}
          autoApproveCap={autoApproveCap}
          onApprove={onApprove}
          onSkip={onSkip}
          onRetry={onRetry}
          onAbort={onAbort}
          onApprovePlan={onApprovePlan}
          onRequestPlanChanges={onRequestPlanChanges}
        />
      </div>

      <div style={{ marginTop: 18 }}>
        <OutputStream lines={lines} droppedLineCount={droppedLineCount} />
      </div>
    </div>
  );
}
