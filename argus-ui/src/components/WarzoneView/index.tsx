import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { clsx } from 'clsx';
import type { WarzoneState, OutputLine } from '../../types';
import { DiscussionReview } from './DiscussionReview';

interface WarzoneViewProps {
  state: WarzoneState;
  idea: string | null;
  lines: OutputLine[];
  onSubmit: (idea: string) => void;
  onApprove: () => void;
  onAbort: () => void;
}

const STATE_LABELS: Record<WarzoneState, string> = {
  idle: 'Ready',
  discussing_claude: 'Claude Planning',
  discussing_gemini: 'Gemini Building',
  discussing_codex: 'Codex Auditing',
  awaiting_discuss_approval: 'Discussion Complete',
};

function DiscussProgress({ state }: { state: WarzoneState }) {
  const steps = [
    { key: 'discussing_claude', label: 'Claude' },
    { key: 'discussing_gemini', label: 'Gemini' },
    { key: 'discussing_codex', label: 'Codex' },
    { key: 'awaiting_discuss_approval', label: 'Review' },
  ];
  const order = [
    'idle',
    'discussing_claude',
    'discussing_gemini',
    'discussing_codex',
    'awaiting_discuss_approval',
  ];
  const currentIdx = order.indexOf(state);

  return (
    <div className="w-full">
      <div className="flex w-full">
        {steps.map((step) => {
          const stepIdx = order.indexOf(step.key);
          const done = currentIdx > stepIdx;
          const active = state === step.key;
          return (
            <div
              key={step.key}
              className="flex-1"
              style={{
                height: done || active ? 2 : 1,
                background: done || active ? 'var(--color-accent)' : 'var(--color-ink-3)',
                marginRight: 2,
              }}
            />
          );
        })}
      </div>
      <div className="flex w-full" style={{ marginTop: 8 }}>
        {steps.map((step) => {
          const stepIdx = order.indexOf(step.key);
          const done = currentIdx > stepIdx;
          const active = state === step.key;
          return (
            <span
              key={step.key}
              className="flex-1 uppercase"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.15em',
                color: done || active ? 'var(--color-fg-0)' : 'var(--color-fg-2)',
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

function DiscussionPanel({ lines }: { lines: OutputLine[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <div
      className="flex-1 overflow-y-auto min-h-0"
      style={{
        background: 'var(--color-ink-2)',
        color: 'var(--color-fg-0)',
        border: '1px solid var(--color-ink-3)',
        padding: 24,
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        lineHeight: 1.55,
      }}
    >
      {lines.length === 0 ? (
        <p style={{ color: 'var(--color-fg-2)' }}>
          Agent discussion will appear here.
        </p>
      ) : (
        lines.map((l, i) => (
          <div key={i}>
            <span style={{ color: 'var(--color-accent)' }}>[{l.agent}]</span>{' '}
            <span style={{ color: 'var(--color-fg-2)' }}>·</span>{' '}
            <span style={{ color: 'var(--color-fg-0)' }}>{l.line}</span>
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}

export function WarzoneView({
  state,
  idea,
  lines,
  onSubmit,
  onApprove,
  onAbort,
}: WarzoneViewProps) {
  const [input, setInput] = useState('');
  const busy =
    state === 'discussing_claude' ||
    state === 'discussing_gemini' ||
    state === 'discussing_codex';
  const showForm = state === 'idle';
  const showApproval = state === 'awaiting_discuss_approval';

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
    <div
      className="flex flex-col h-full"
      style={{
        background: 'var(--color-ink-0)',
        color: 'var(--color-fg-0)',
      }}
    >
      {/* Header */}
      <div
        className="shrink-0"
        style={{
          padding: '40px 60px 28px',
          borderBottom: '1px solid var(--color-ink-3)',
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p
              className="uppercase"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.15em',
                color: 'var(--color-accent)',
                marginBottom: 10,
              }}
            >
              Three-agent discussion
            </p>
            <h1
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 44,
                fontWeight: 400,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                margin: 0,
                color: 'var(--color-fg-0)',
              }}
            >
              Warzone
            </h1>
            <p
              style={{
                fontSize: 14,
                fontWeight: 400,
                color: 'var(--color-fg-1)',
                marginTop: 8,
              }}
            >
              Sequential pre-build discussion.
            </p>
          </div>
          <span
            className={clsx('uppercase')}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: '0.15em',
              paddingTop: 18,
              color: busy
                ? 'var(--color-accent)'
                : showApproval
                  ? 'var(--color-fg-0)'
                  : 'var(--color-fg-2)',
            }}
          >
            {STATE_LABELS[state]}
          </span>
        </div>

        {state !== 'idle' && (
          <div style={{ marginTop: 28 }}>
            <DiscussProgress state={state} />
          </div>
        )}

        {idea && (
          <p
            className="truncate"
            style={{
              marginTop: 24,
              fontSize: 14,
              fontWeight: 400,
              color: 'var(--color-fg-1)',
              lineHeight: 1.3,
              fontFamily: 'var(--font-mono)',
            }}
          >
            › {idea}
          </p>
        )}
      </div>

      {/* Content */}
      <div
        className="flex-1 flex flex-col min-h-0"
        style={{ padding: '32px 60px', gap: 28 }}
      >
        {/* Explanation when idle */}
        {state === 'idle' && lines.length === 0 && (
          <div style={{ maxWidth: 720 }}>
            <h2
              className="uppercase"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: '0.15em',
                color: 'var(--color-fg-2)',
                marginBottom: 16,
              }}
            >
              How warzone works
            </h2>
            <ol
              style={{
                fontSize: 15,
                fontWeight: 400,
                color: 'var(--color-fg-1)',
                lineHeight: 1.6,
                paddingLeft: 24,
                margin: 0,
              }}
            >
              <li>Claude frames the idea as a planner (files, approach, gotchas).</li>
              <li>Gemini proposes a build approach (stack, steps, concerns).</li>
              <li>Codex audits both takes and pokes holes.</li>
              <li>You review WarZone.md, then approve.</li>
              <li>
                Take the discussion to Build and reference WarZone.md in your prompt.
              </li>
            </ol>
          </div>
        )}

        {/* During busy phases: raw log. On complete: pretty-printed markdown review. */}
        {showApproval ? (
          <DiscussionReview refreshKey={state} />
        ) : (
          lines.length > 0 && <DiscussionPanel lines={lines} />
        )}

        {/* Approval */}
        {showApproval && (
          <div
            className="shrink-0"
            style={{
              background: 'var(--color-ink-1)',
              border: '1px solid var(--color-ink-3)',
              padding: 28,
            }}
          >
            <h2
              className="uppercase"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '0.15em',
                color: 'var(--color-fg-1)',
                margin: 0,
                marginBottom: 10,
              }}
            >
              Discussion ready
            </h2>
            <p
              style={{
                fontSize: 15,
                color: 'var(--color-fg-1)',
                lineHeight: 1.55,
                margin: 0,
                marginBottom: 24,
              }}
            >
              All three agents have written their takes. Approve to save
              WarZone.md as a reference, then use it in Build.
            </p>
            <div className="flex items-center" style={{ gap: 16 }}>
              <button
                onClick={onApprove}
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: 1.2,
                  letterSpacing: '0.02em',
                  padding: '12px 22px',
                  background: 'var(--color-accent)',
                  color: 'var(--color-ink-0)',
                  border: '1px solid var(--color-accent)',
                  cursor: 'pointer',
                  transition: 'background 150ms ease-out, border-color 150ms ease-out',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-accent-dim)';
                  e.currentTarget.style.borderColor = 'var(--color-accent-dim)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--color-accent)';
                  e.currentTarget.style.borderColor = 'var(--color-accent)';
                }}
              >
                Approve →
              </button>
              <button
                onClick={onAbort}
                className="uppercase"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: '0.15em',
                  padding: '10px 0 8px',
                  color: 'var(--color-danger)',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--color-danger)',
                  cursor: 'pointer',
                  opacity: 0.8,
                  transition: 'opacity 150ms ease-out',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.8')}
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Idea input */}
        {showForm && (
          <div className="shrink-0">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What do you want to discuss? (e.g. build a real-time dashboard for Argus)"
              rows={3}
              className="w-full outline-none resize-none"
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 15,
                fontWeight: 400,
                color: 'var(--color-fg-0)',
                lineHeight: 1.55,
                padding: '14px 0 12px',
                background: 'transparent',
                borderBottom: '1px solid var(--color-ink-3)',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                transition: 'border-color 150ms ease-out',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderBottom = '2px solid var(--color-accent)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderBottom = '1px solid var(--color-ink-3)';
              }}
            />
            <div
              className="flex items-center justify-between"
              style={{ marginTop: 20 }}
            >
              <p
                className="uppercase"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--color-fg-2)',
                  letterSpacing: '0.15em',
                  margin: 0,
                }}
              >
                Enter to submit · Shift + Enter for new line
              </p>
              <button
                onClick={handleSubmit}
                disabled={!input.trim()}
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: 1.2,
                  letterSpacing: '0.02em',
                  padding: '12px 22px',
                  background: !input.trim() ? 'transparent' : 'var(--color-accent)',
                  color: !input.trim() ? 'var(--color-fg-2)' : 'var(--color-ink-0)',
                  border: `1px solid ${!input.trim() ? 'var(--color-ink-3)' : 'var(--color-accent)'}`,
                  cursor: !input.trim() ? 'not-allowed' : 'pointer',
                  transition: 'background 150ms ease-out, border-color 150ms ease-out',
                }}
                onMouseEnter={(e) => {
                  if (input.trim()) {
                    e.currentTarget.style.background = 'var(--color-accent-dim)';
                    e.currentTarget.style.borderColor = 'var(--color-accent-dim)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (input.trim()) {
                    e.currentTarget.style.background = 'var(--color-accent)';
                    e.currentTarget.style.borderColor = 'var(--color-accent)';
                  }
                }}
              >
                Start discussion →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
