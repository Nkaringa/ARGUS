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

/* ────────────────────────────── breadcrumbs ────────────────────────────── */

function Breadcrumbs({
  slug,
  viewMode,
  onViewModeChange,
}: {
  slug: string | null;
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
}) {
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
      <span style={{ color: 'var(--accent)' }}>build</span>
      {slug && (
        <>
          <span style={{ color: 'var(--rule-hot)' }}>·</span>
          <span>
            slug <span style={{ color: 'var(--ink)' }}>{slug}</span>
          </span>
        </>
      )}
      <span style={{ color: 'var(--ink-dim)', fontSize: 10, marginLeft: 'auto' }}>
        ws <b style={{ color: 'var(--accent)', fontWeight: 500 }}>3002</b> connected
      </span>
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

function HeroCard({
  state,
  slug,
  task,
  iteration,
}: {
  state: BuildState;
  slug: string | null;
  task: string | null;
  iteration: number;
}) {
  const stateLabel =
    state === 'idle' ? 'ready for a task' :
    state === 'done' ? 'complete' :
    state === 'paused' ? 'paused' :
    state === 'awaiting_approval' ? 'awaiting review' :
    state;

  return (
    <section
      style={{
        marginTop: 20,
        border: '1px solid var(--rule)',
        background: 'var(--bg-2)',
        display: 'grid',
        gridTemplateColumns: task ? '1fr auto' : '1fr',
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
          // pipeline state: <b style={{ color: 'var(--accent)', fontWeight: 500 }}>{stateLabel}</b>
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
            <span style={{ color: 'var(--ink-dimmer)' }}>no active build</span>
          )}
        </h1>
        {task && (
          <p
            style={{
              marginTop: 16,
              fontSize: 13,
              color: 'var(--ink)',
              lineHeight: 1.55,
              maxWidth: '80ch',
            }}
          >
            <span style={{ color: 'var(--ink-dim)' }}>$ task →</span> {task}
          </p>
        )}
      </div>

      {task && (
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
          <MetaBlock label="iteration" value={iteration > 0 ? String(iteration) : '—'} />
          <MetaBlock label="mode" value={iteration > 0 ? 'revision' : 'new'} mono />
          <MetaBlock label="watcher" value="● chokidar armed" lime />
        </div>
      )}
    </section>
  );
}

function MetaBlock({ label, value, lime, mono }: { label: string; value: string; lime?: boolean; mono?: boolean }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.14em',
          color: 'var(--ink-dimmer)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: mono ? 'var(--font-body)' : 'var(--font-display)',
          fontSize: mono ? 14 : 18,
          fontWeight: 500,
          color: lime ? 'var(--accent)' : 'var(--ink)',
          marginTop: 4,
        }}
      >
        {value}
      </div>
    </div>
  );
}

/* ────────────────────────────── pipeline strip ────────────────────────────── */

function PipelineStrip({ state }: { state: BuildState }) {
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
        pipeline · plan → build → audit → review → done
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr auto 1fr auto 1fr auto 1fr',
          gap: 12,
          alignItems: 'stretch',
        }}
      >
        {PIPELINE_STEPS.map((step, i) => {
          const stepFirstMatchIdx = STATE_ORDER.indexOf(step.matchStates[0]);
          const done = currentIdx > stepFirstMatchIdx;
          const active =
            step.matchStates.includes(state) ||
            (state === 'paused' && step.key === 'build');

          const borderColor = active ? 'var(--accent)' : done ? 'var(--accent-dim)' : 'var(--rule-hot)';
          const background = active ? 'rgba(196,255,61,0.08)' : done ? 'rgba(196,255,61,0.03)' : 'var(--bg-3)';
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

/* ────────────────────────────── agent monitor ────────────────────────────── */

function AgentMonitor({ state }: { state: BuildState }) {
  const agents: { key: 'claude' | 'gemini' | 'codex'; role: string; activeState: BuildState; color: string }[] = [
    { key: 'claude', role: 'planner', activeState: 'planning', color: 'var(--claude)' },
    { key: 'gemini', role: 'builder', activeState: 'building', color: 'var(--gemini)' },
    { key: 'codex',  role: 'auditor', activeState: 'auditing', color: 'var(--codex)'  },
  ];
  return (
    <Panel headLabel="agent monitor" headRight="3 agents · role docs resumed">
      {agents.map((a, i) => {
        const isActive = state === a.activeState;
        const queued = stateIndex(a.activeState) > stateIndex(state) && state !== 'idle' && state !== 'done';
        const label = isActive ? a.activeState : queued ? 'queued' : 'idle';
        return (
          <div
            key={a.key}
            style={{
              display: 'grid',
              gridTemplateColumns: '10px 1fr auto',
              gap: 14,
              alignItems: 'center',
              padding: '14px 18px',
              borderBottom: i < agents.length - 1 ? '1px dashed var(--rule)' : 'none',
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: isActive ? 'var(--accent)' : queued ? 'var(--ink-dim)' : 'var(--ink-dimmer)',
                boxShadow: isActive ? '0 0 10px var(--accent)' : 'none',
                animation: isActive ? 'pulse 1.4s ease-in-out infinite' : undefined,
              }}
            />
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, color: a.color }}>
                {a.key}
              </div>
              <div style={{ fontSize: 10, color: 'var(--ink-dim)', letterSpacing: '0.08em', marginTop: 2 }}>
                [ {a.role} ]
              </div>
            </div>
            <span
              style={{
                fontSize: 10,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: isActive ? 'var(--accent)' : 'var(--ink-dim)',
                padding: '3px 8px',
                border: `1px solid ${isActive ? 'var(--accent)' : 'var(--rule-hot)'}`,
              }}
            >
              {label.replace(/_/g, ' ')}
            </span>
          </div>
        );
      })}
    </Panel>
  );
}

/* ────────────────────────────── active stage ────────────────────────────── */

function ActiveStage({
  state,
  iteration,
  grade,
  slug,
  stageStartedAt,
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
  stageStartedAt: number;
  autoApprove: boolean;
  autoApproveCap: number;
  onApprove: () => void;
  onSkip: () => void;
  onRetry: () => void;
  onAbort: () => void;
  onApprovePlan: () => void;
  onRequestPlanChanges: (feedback: string) => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!['planning', 'building', 'auditing'].includes(state)) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state]);

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

  const cfg = STAGE_CONFIG[state];
  if (!cfg) return null;

  const elapsedMs = now - stageStartedAt;
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const overBudget = elapsedSec > cfg.expectedSec;

  return (
    <Panel headLabel="active stage" headRight={`// agent is working${iteration > 0 ? ` · iteration ${iteration}` : ''}`}>
      <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
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
          {cfg.agent} :: {cfg.description}
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 40, fontWeight: 500, lineHeight: 1, letterSpacing: '-0.03em' }}>
          <span style={{ color: cfg.agentColor }}>{cfg.agent}</span>{' '}
          <span style={{ color: 'var(--ink)' }}>is working</span>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, auto)',
            gap: 36,
            paddingTop: 12,
            borderTop: '1px dashed var(--rule)',
            alignItems: 'baseline',
          }}
        >
          <StatBlock label="elapsed" value={formatElapsed(elapsedMs)} lime={!overBudget} />
          <StatBlock label="typical" value={`${cfg.expectedSec}s`} dim />
          <StatBlock label="iteration" value={iteration > 0 ? String(iteration) : '1'} />
          {overBudget && (
            <div style={{ alignSelf: 'flex-end', paddingBottom: 4 }}>
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--warn)',
                  padding: '4px 8px',
                  border: '1px solid var(--warn)',
                }}
              >
                ⚠ over budget
              </span>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
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

function StatBlock({ label, value, lime, dim }: { label: string; value: string; lime?: boolean; dim?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--ink-dimmer)', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28,
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
          color: lime ? 'var(--accent)' : dim ? 'var(--ink-dim)' : 'var(--ink)',
        }}
      >
        {value}
      </div>
    </div>
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
        <span>nats://localhost:4222 · subj build.output</span>
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
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
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
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label
            htmlFor="auto-toggle"
            style={{
              fontSize: 10,
              letterSpacing: '0.14em',
              color: 'var(--ink-dimmer)',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            <input
              id="auto-toggle"
              type="checkbox"
              checked={autoOn}
              onChange={(e) => setAutoOn(e.target.checked)}
              disabled={disabled}
            />
            auto-approve revisions
          </label>
          {autoOn && (
            <>
              <label
                htmlFor="auto-cap"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  color: 'var(--ink-dimmer)',
                  textTransform: 'uppercase',
                }}
              >
                max iterations
              </label>
              <input
                id="auto-cap"
                type="number"
                min={1}
                max={20}
                placeholder="10"
                value={capInput}
                onChange={(e) => setCapInput(e.target.value)}
                disabled={disabled}
                style={{
                  width: 60,
                  fontSize: 12,
                  color: 'var(--ink)',
                  background: 'var(--bg-3)',
                  padding: '6px 10px',
                  border: '1px solid var(--rule)',
                }}
              />
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label
            htmlFor="plan-review-toggle"
            style={{
              fontSize: 10,
              letterSpacing: '0.14em',
              color: 'var(--ink-dimmer)',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            <input
              id="plan-review-toggle"
              type="checkbox"
              checked={planReviewOn}
              onChange={(e) => setPlanReviewOn(e.target.checked)}
              disabled={disabled}
            />
            review plan before build
          </label>
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
            {continueSlug ? 'continue build →' : 'start build →'}
          </ActionButton>
        </div>
      </div>
    </Panel>
  );
}

/* ────────────────────────────── last audit ────────────────────────────── */

function LastAudit({ grade, iteration }: { grade?: string; iteration: number }) {
  return (
    <Panel headLabel="last audit" headRight={grade ? `iter ${iteration} · codex` : 'no audit yet'}>
      <div
        style={{
          padding: '22px 24px',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: 22,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 84,
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
          <div style={{ fontSize: 13, color: 'var(--ink)', marginBottom: 12 }}>
            {grade === 'A'
              ? 'A · no revisions requested'
              : grade
                ? `${grade} · codex flagged issues`
                : 'audit runs after the builder emits build-log.md'}
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

/* ────────────────────────────── task meta ────────────────────────────── */

function TaskMeta({ slug, state, iteration }: { slug: string | null; state: BuildState; iteration: number }) {
  const planDone = ['building', 'auditing', 'awaiting_approval', 'done', 'paused'].includes(state);
  const buildDone = ['auditing', 'awaiting_approval', 'done'].includes(state);
  const feedbackDone = ['awaiting_approval', 'done'].includes(state);

  return (
    <Panel headLabel="task meta" headRight="live from hermes">
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <MetaRow k="slug" v={slug ?? '—'} code />
        <MetaRow k="iteration" v={iteration > 0 ? String(iteration) : '—'} />
        <MetaRow
          k="signals"
          v={
            <>
              <Signal on={planDone}>plan</Signal>&nbsp;&nbsp;
              <Signal on={buildDone}>build</Signal>&nbsp;&nbsp;
              <Signal on={feedbackDone}>feedback</Signal>
            </>
          }
        />
        <MetaRow k="subject" v="build.output" code />
        <MetaRow k="durability" v="sqlite WAL · replay" />
      </div>
    </Panel>
  );
}

function MetaRow({ k, v, code }: { k: string; v: React.ReactNode; code?: boolean }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '110px 1fr',
        gap: 12,
        fontSize: 11.5,
        paddingBottom: 10,
        borderBottom: '1px dashed var(--rule)',
      }}
    >
      <span style={{ color: 'var(--ink-dimmer)', letterSpacing: '0.08em' }}>{k}</span>
      <span style={{ color: 'var(--ink)' }}>
        {code ? (
          <code
            style={{
              fontFamily: 'var(--font-body)',
              background: 'var(--bg-3)',
              padding: '1px 6px',
              fontSize: 10.5,
            }}
          >
            {v}
          </code>
        ) : (
          v
        )}
      </span>
    </div>
  );
}

function Signal({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span style={{ color: on ? 'var(--accent)' : 'var(--ink-dimmer)' }}>
      {on ? '✓' : '○'} {children}
    </span>
  );
}

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
        <Breadcrumbs slug={slug} viewMode={viewMode} onViewModeChange={setViewMode} />

        {/* Compact state strip so the user still sees pipeline progress while browsing files */}
        <div style={{ marginTop: 18, flexShrink: 0 }}>
          <PipelineStrip state={state} />
        </div>

        {/* Split pane: file tree on left, inline preview on right */}
        <section
          style={{
            marginTop: 18,
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: '320px 1fr',
            gap: 18,
          }}
        >
          <Panel fill headLabel="files" headRight="work directory · live">
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <FileBrowser
                onFileSelect={setSelectedFile}
                externalSelectedFile={selectedFile}
              />
            </div>
          </Panel>
          <InlinePreview path={selectedFile} />
        </section>
      </div>
    );
  }

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
      <Breadcrumbs slug={slug} viewMode={viewMode} onViewModeChange={setViewMode} />

      <HeroCard state={state} slug={slug} task={task} iteration={iteration} />

      <PipelineStrip state={state} />

      <section style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '340px 1fr', gap: 18 }}>
        <AgentMonitor state={state} />
        <ActiveStage
          state={state}
          iteration={iteration}
          grade={grade}
          slug={slug}
          stageStartedAt={stageStartedAt}
          autoApprove={autoApprove}
          autoApproveCap={autoApproveCap}
          onApprove={onApprove}
          onSkip={onSkip}
          onRetry={onRetry}
          onAbort={onAbort}
          onApprovePlan={onApprovePlan}
          onRequestPlanChanges={onRequestPlanChanges}
        />
      </section>

      <div style={{ marginTop: 18 }}>
        <OutputStream lines={lines} droppedLineCount={droppedLineCount} />
      </div>

      <section style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr', gap: 18 }}>
        <TaskInputPanel state={state} projects={projects} onSubmit={onSubmit} />
        <LastAudit grade={grade} iteration={iteration} />
        <TaskMeta slug={slug} state={state} iteration={iteration} />
      </section>
    </div>
  );
}
