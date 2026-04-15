import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { clsx } from 'clsx';
import type { BuildState, OutputLine } from '../../types';

interface BuildViewProps {
  state: BuildState;
  task: string | null;
  iteration: number;
  grade?: string;
  lines: OutputLine[];
  onSubmit: (description: string) => void;
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

function OutputLog({ lines }: { lines: OutputLine[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

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

export function BuildView({
  state,
  task,
  iteration,
  grade,
  lines,
  onSubmit,
  onApprove,
  onSkip,
  onRetry,
  onAbort,
}: BuildViewProps) {
  const [input, setInput] = useState('');
  const busy = ['planning', 'building', 'auditing'].includes(state);
  const showForm = state === 'idle' || state === 'done';
  const showApproval = state === 'awaiting_approval';
  const showPaused = state === 'paused';

  const handleSubmit = () => {
    const text = input.trim();
    if (!text) return;
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
    <div className="flex flex-col h-full bg-white text-[#262626]">
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
        {lines.length > 0 && <OutputLog lines={lines} />}

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
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what you want to build..."
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
                Start Build →
              </PrimaryButton>
            </div>
          </div>
        )}
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
