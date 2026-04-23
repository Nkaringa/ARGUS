import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { clsx } from 'clsx';
import type { BuildState, OutputLine } from '../../types';
import { FileBrowser } from './FileBrowser';

interface BuildViewProps {
  state: BuildState;
  task: string | null;
  iteration: number;
  grade?: string;
  lines: OutputLine[];
  droppedLineCount: number;
  projects: string[];
  onSubmit: (description: string, opts?: { mode: 'new' | 'continue'; slug?: string }) => void;
  onApprove: () => void;
  onSkip: () => void;
  onRetry: () => void;
  onAbort: () => void;
}

const STATE_LABELS: Record<BuildState, string> = {
  idle: 'Ready',
  planning: 'Planning',
  building: 'Building',
  auditing: 'Auditing',
  awaiting_approval: 'Awaiting Review',
  paused: 'Paused',
  done: 'Complete',
};

function ProgressStrip({ state }: { state: BuildState }) {
  const steps: { key: BuildState | string; label: string }[] = [
    { key: 'planning', label: 'Plan' },
    { key: 'building', label: 'Build' },
    { key: 'auditing', label: 'Audit' },
    { key: 'awaiting_approval', label: 'Review' },
    { key: 'done', label: 'Done' },
  ];
  const stateOrder = ['idle', 'planning', 'building', 'auditing', 'awaiting_approval', 'paused', 'done'];
  const currentIdx = stateOrder.indexOf(state);

  return (
    <div className="w-full">
      <div className="flex w-full">
        {steps.map((step) => {
          const stepIdx = stateOrder.indexOf(step.key as BuildState);
          const done = currentIdx > stepIdx;
          const active = state === step.key || (state === 'paused' && step.key === 'building');
          return (
            <div
              key={step.key}
              className="flex-1"
              style={{
                height: done || active ? 2 : 1,
                background: done || active ? '#1c69d4' : '#bbbbbb',
                marginRight: 2,
              }}
            />
          );
        })}
      </div>
      <div className="flex w-full mt-2">
        {steps.map((step) => {
          const stepIdx = stateOrder.indexOf(step.key as BuildState);
          const done = currentIdx > stepIdx;
          const active = state === step.key || (state === 'paused' && step.key === 'building');
          const activeColor = done || active ? '#262626' : '#bbbbbb';
          return (
            <span
              key={step.key}
              className="flex-1 uppercase"
              style={{
                fontSize: 12,
                fontWeight: 400,
                letterSpacing: '0.15em',
                color: activeColor,
              }}
            >
              {step.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function OutputLog({ lines, droppedLineCount }: { lines: OutputLine[]; droppedLineCount: number }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const totalLines = lines.length + droppedLineCount;

  return (
    <div
      className="flex-1 overflow-y-auto min-h-0"
      style={{
        background: '#262626',
        color: '#ffffff',
        padding: 32,
        fontFamily: 'var(--font-body)',
        fontSize: 14,
        lineHeight: 1.3,
      }}
    >
      {droppedLineCount > 0 && (
        <div
          className="uppercase"
          style={{
            color: '#bbbbbb',
            fontSize: 11,
            letterSpacing: '0.15em',
            paddingBottom: 12,
            marginBottom: 12,
            borderBottom: '1px solid #3a3a3a',
          }}
        >
          Showing last {lines.length} of {totalLines} lines · {droppedLineCount} earlier {droppedLineCount === 1 ? 'line' : 'lines'} dropped from view
        </div>
      )}
      {lines.length === 0 ? (
        <p style={{ color: '#757575' }}>Output will appear here.</p>
      ) : (
        lines.map((l, i) => (
          <div key={i}>
            <span style={{ color: '#bbbbbb' }}>[{l.agent}]</span>{' '}
            <span style={{ color: '#ffffff' }}>{l.line}</span>
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}

// Per-stage agent, human-readable description, and a "typical" duration used as a
// reference point — these are derived from the 16-task baseline captured in memory
// (planning ~71s, building ~54s, auditing ~87s) rounded to cleaner numbers. They
// exist only to ground the elapsed-time display; they do not gate anything.
const STAGE_CONFIG: Partial<Record<BuildState, { agent: string; description: string; expectedSec: number }>> = {
  planning: {
    agent: 'Claude',
    description: 'Writing the plan that Gemini will build from',
    expectedSec: 70,
  },
  building: {
    agent: 'Gemini',
    description: 'Creating files from the plan',
    expectedSec: 55,
  },
  auditing: {
    agent: 'Codex',
    description: 'Reviewing the build for correctness',
    expectedSec: 90,
  },
};

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

function ActiveStageBanner({
  state,
  stageStartedAt,
  iteration,
}: {
  state: BuildState;
  stageStartedAt: number;
  iteration: number;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const cfg = STAGE_CONFIG[state];
  if (!cfg) return null;

  const elapsedMs = now - stageStartedAt;
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const overBudget = elapsedSec > cfg.expectedSec;

  return (
    <div
      className="shrink-0"
      style={{
        background: '#f7f7f7',
        padding: '40px 48px',
        borderLeft: '2px solid #1c69d4',
      }}
    >
      <div className="flex items-center" style={{ gap: 10, marginBottom: 12 }}>
        <span
          className="animate-pulse"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#1c69d4',
            display: 'inline-block',
          }}
        />
        <span
          className="uppercase"
          style={{ fontSize: 11, letterSpacing: '0.15em', color: '#757575' }}
        >
          Agent running{iteration > 0 ? ` · iteration ${iteration}` : ''}
        </span>
      </div>

      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 40,
          fontWeight: 300,
          lineHeight: 1.15,
          color: '#262626',
          marginBottom: 12,
          letterSpacing: '0.01em',
        }}
      >
        <span style={{ color: '#1c69d4' }}>{cfg.agent}</span> is working
      </h2>

      <p
        style={{
          fontSize: 16,
          fontWeight: 400,
          color: '#262626',
          lineHeight: 1.4,
          marginBottom: 32,
          maxWidth: 640,
        }}
      >
        {cfg.description}.
      </p>

      <div className="flex items-baseline" style={{ gap: 56, flexWrap: 'wrap' }}>
        <div>
          <div
            className="uppercase"
            style={{ fontSize: 11, letterSpacing: '0.15em', color: '#757575', marginBottom: 6 }}
          >
            Elapsed
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 32,
              fontWeight: 300,
              color: overBudget ? '#262626' : '#1c69d4',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatElapsed(elapsedMs)}
          </div>
        </div>
        <div>
          <div
            className="uppercase"
            style={{ fontSize: 11, letterSpacing: '0.15em', color: '#757575', marginBottom: 6 }}
          >
            Typical
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 32,
              fontWeight: 300,
              color: '#bbbbbb',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {cfg.expectedSec}s
          </div>
        </div>
        {overBudget && (
          <div style={{ alignSelf: 'flex-end', paddingBottom: 8 }}>
            <span
              className="uppercase"
              style={{ fontSize: 11, letterSpacing: '0.15em', color: '#757575' }}
            >
              Taking longer than usual
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function BuildView({
  state,
  task,
  iteration,
  grade,
  lines,
  droppedLineCount,
  projects,
  onSubmit,
  onApprove,
  onSkip,
  onRetry,
  onAbort,
}: BuildViewProps) {
  const [input, setInput] = useState('');
  // 'new' or an existing project slug. Derived during render: if the stored
  // selection points at a slug that no longer exists in `projects` (user deleted
  // the folder, or the list refreshed without it), fall back to 'new' — without
  // the effect-based state sync that React 19 flags.
  const [projectSel, setProjectSel] = useState<string>('new');
  const effectiveProjectSel =
    projectSel !== 'new' && !projects.includes(projectSel) ? 'new' : projectSel;
  const busy = ['planning', 'building', 'auditing'].includes(state);
  const showForm = state === 'idle' || state === 'done';
  const showApproval = state === 'awaiting_approval';
  const showPaused = state === 'paused';
  const continueSlug = effectiveProjectSel === 'new' ? null : effectiveProjectSel;

  // Stamp when each stage begins so the banner can show elapsed time. Resetting
  // on every state change is intentional — planning → building → auditing each
  // get their own counter, and transitions back to idle/done clear it naturally
  // (the banner only renders during busy states anyway).
  const [stageStartedAt, setStageStartedAt] = useState<number>(() => Date.now());
  useEffect(() => {
    setStageStartedAt(Date.now());
  }, [state]);

  const handleSubmit = () => {
    const text = input.trim();
    if (!text) return;
    if (continueSlug) {
      onSubmit(text, { mode: 'continue', slug: continueSlug });
    } else {
      onSubmit(text);
    }
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex h-full bg-white text-[#262626]">
      <FileBrowser />
      <div className="flex-1 min-w-0 flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0" style={{ padding: '48px 60px 32px', borderBottom: '1px solid #bbbbbb' }}>
        <div className="flex items-start justify-between">
          <div>
            <h1
              className="uppercase"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 60,
                fontWeight: 300,
                lineHeight: 1.3,
                letterSpacing: '0.02em',
              }}
            >
              Build
            </h1>
            <p
              style={{
                fontSize: 14,
                fontWeight: 400,
                color: '#757575',
                marginTop: 8,
              }}
            >
              Claude plans · Gemini builds · Codex audits
            </p>
          </div>
          <div className="flex flex-col items-end" style={{ gap: 8, paddingTop: 24 }}>
            <span
              className={clsx('uppercase', busy ? 'text-[#1c69d4]' : state === 'done' ? 'text-[#262626]' : 'text-[#bbbbbb]')}
              style={{ fontSize: 12, fontWeight: 400, letterSpacing: '0.15em' }}
            >
              {STATE_LABELS[state]}
            </span>
            {iteration > 0 && (
              <span className="uppercase" style={{ fontSize: 12, color: '#757575', letterSpacing: '0.15em' }}>
                Iteration {iteration}
              </span>
            )}
          </div>
        </div>

        {(busy || state === 'awaiting_approval' || state === 'done') && (
          <div style={{ marginTop: 32 }}>
            <ProgressStrip state={state} />
          </div>
        )}

        {task && (
          <p
            className="truncate"
            style={{
              marginTop: 24,
              fontSize: 14,
              fontWeight: 400,
              color: '#757575',
              lineHeight: 1.3,
            }}
          >
            {task}
          </p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0" style={{ padding: '40px 60px', gap: 32 }}>
        {busy && (
          <ActiveStageBanner state={state} stageStartedAt={stageStartedAt} iteration={iteration} />
        )}

        {busy && lines.length > 0 ? (
          <details className="shrink-0">
            <summary
              className="uppercase cursor-pointer"
              style={{
                fontSize: 12,
                letterSpacing: '0.15em',
                color: '#757575',
                padding: '8px 0',
                listStyle: 'none',
              }}
            >
              Agent output ({lines.length + droppedLineCount} {lines.length + droppedLineCount === 1 ? 'line' : 'lines'})
            </summary>
            <div style={{ marginTop: 16, height: 320, display: 'flex', flexDirection: 'column' }}>
              <OutputLog lines={lines} droppedLineCount={droppedLineCount} />
            </div>
          </details>
        ) : (
          lines.length > 0 && <OutputLog lines={lines} droppedLineCount={droppedLineCount} />
        )}

        {/* Approval panel */}
        {showApproval && (
          <div className="shrink-0 bg-white" style={{ padding: '32px 0' }}>
            <div className="flex items-end justify-between" style={{ marginBottom: 24 }}>
              <h2
                className="uppercase"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 18,
                  fontWeight: 900,
                  letterSpacing: '0.15em',
                  color: '#262626',
                }}
              >
                Audit Complete
              </h2>
              {grade && (
                <span
                  className="uppercase"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 60,
                    fontWeight: 300,
                    lineHeight: 1,
                    color: grade === 'A' ? '#1c69d4' : '#262626',
                  }}
                >
                  {grade}
                </span>
              )}
            </div>
            <p style={{ fontSize: 16, fontWeight: 400, color: '#757575', lineHeight: 1.3, marginBottom: 32 }}>
              Codex flagged issues. Revise to continue with another iteration, or skip to mark done.
            </p>
            <div className="flex items-center" style={{ gap: 24 }}>
              <PrimaryButton onClick={onApprove}>Revise →</PrimaryButton>
              <SecondaryButton onClick={onSkip}>Skip</SecondaryButton>
              <div className="ml-auto">
                <SecondaryButton onClick={onAbort} bold>Abort</SecondaryButton>
              </div>
            </div>
          </div>
        )}

        {/* Paused panel */}
        {showPaused && (
          <div className="shrink-0 bg-white" style={{ padding: '32px 0' }}>
            <h2
              className="uppercase"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: '0.15em',
                color: '#262626',
                marginBottom: 12,
              }}
            >
              Paused After Retry
            </h2>
            <p style={{ fontSize: 16, fontWeight: 400, color: '#757575', lineHeight: 1.3, marginBottom: 32 }}>
              Agent failed twice. Retry manually or abort.
            </p>
            <div className="flex items-center" style={{ gap: 24 }}>
              <PrimaryButton onClick={onRetry}>Retry →</PrimaryButton>
              <SecondaryButton onClick={onAbort} bold>Abort</SecondaryButton>
            </div>
          </div>
        )}

        {/* Task input */}
        {showForm && (
          <div className="shrink-0">
            <div style={{ marginBottom: 24 }}>
              <label
                className="uppercase"
                htmlFor="project-selector"
                style={{
                  fontSize: 12,
                  color: '#757575',
                  letterSpacing: '0.15em',
                  marginRight: 16,
                }}
              >
                Project
              </label>
              <select
                id="project-selector"
                value={effectiveProjectSel}
                onChange={(e) => setProjectSel(e.target.value)}
                className="bg-transparent outline-none"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#262626',
                  letterSpacing: '0.05em',
                  padding: '8px 0',
                  borderBottom: '1px solid #262626',
                  minWidth: 240,
                }}
              >
                <option value="new">New project</option>
                {projects.map((slug) => (
                  <option key={slug} value={slug}>
                    Continue: {slug}
                  </option>
                ))}
              </select>
              <p
                style={{
                  fontSize: 12,
                  color: '#757575',
                  marginTop: 8,
                  lineHeight: 1.3,
                }}
              >
                {continueSlug
                  ? `New work appends to the existing ${continueSlug}/ folder.`
                  : 'Claude picks a slug and Gemini creates a new <slug>/ folder for the deliverables.'}
              </p>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                continueSlug
                  ? `What changes do you want to make to ${continueSlug}?`
                  : 'Describe what you want to build...'
              }
              rows={3}
              className="w-full bg-transparent outline-none resize-none"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 16,
                fontWeight: 400,
                color: '#262626',
                lineHeight: 1.3,
                padding: '16px 0 12px',
                borderBottom: '1px solid #262626',
              }}
              onFocus={(e) => (e.currentTarget.style.borderBottom = '2px solid #1c69d4')}
              onBlur={(e) => (e.currentTarget.style.borderBottom = '1px solid #262626')}
            />
            <div className="flex items-center justify-between" style={{ marginTop: 24 }}>
              <p
                className="uppercase"
                style={{ fontSize: 12, color: '#757575', letterSpacing: '0.15em' }}
              >
                Shift + Enter for new line · Enter to submit
              </p>
              <PrimaryButton onClick={handleSubmit} disabled={!input.trim()}>
                {continueSlug ? 'Continue Build →' : 'Start Build →'}
              </PrimaryButton>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'uppercase transition-colors',
        disabled
          ? 'border border-[#bbbbbb] text-[#bbbbbb] cursor-not-allowed bg-transparent'
          : 'bg-[#1c69d4] text-white border border-[#1c69d4] hover:bg-[#0653b6] hover:border-[#0653b6]'
      )}
      style={{
        fontSize: 16,
        fontWeight: 700,
        lineHeight: 1.2,
        letterSpacing: '0.05em',
        padding: '16px 32px',
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  bold,
}: {
  children: React.ReactNode;
  onClick: () => void;
  bold?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="uppercase text-[#262626] hover:text-[#1c69d4] transition-colors"
      style={{
        fontSize: 16,
        fontWeight: bold ? 700 : 400,
        lineHeight: 1.15,
        letterSpacing: '0.05em',
        padding: '16px 0 12px',
        borderBottom: '1px solid currentColor',
      }}
    >
      {children}
    </button>
  );
}
