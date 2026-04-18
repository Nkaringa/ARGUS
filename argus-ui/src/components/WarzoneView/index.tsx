import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { clsx } from 'clsx';
import type { WarzoneState, OutputLine } from '../../types';
import { DiscussionReview } from './DiscussionReview';

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

function DiscussionPanel({ lines, droppedLineCount }: { lines: OutputLine[]; droppedLineCount: number }) {
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
        <p style={{ color: '#757575' }}>Agent discussion will appear here.</p>
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

export function WarzoneView({ state, idea, slug, lines, droppedLineCount, onSubmit, onApprove, onAbort, onNewDiscussion }: WarzoneViewProps) {
  const [input, setInput] = useState('');
  const busy = state === 'discussing_claude' || state === 'discussing_gemini' || state === 'discussing_codex';
  const showForm = state === 'idle';
  const showApproval = state === 'awaiting_discuss_approval';
  // New Discussion is only meaningful when there's a current discussion to archive AND
  // we're not mid-flight. The server enforces the same gate — this is just UI affordance.
  const canStartNewDiscussion = !!slug && (state === 'idle' || state === 'awaiting_discuss_approval');

  const handleSubmit = () => {
    const text = input.trim();
    if (!text) return;
    onSubmit(text);
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
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
            <p
              className="uppercase"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 60,
                fontWeight: 300,
                lineHeight: 1.3,
                letterSpacing: '0.02em',
              }}
            >
              Warzone
            </h1>
            <p style={{ fontSize: 14, fontWeight: 400, color: '#757575', marginTop: 8 }}>
              Sequential agent discussion
            </p>
          </div>
          <div style={{ paddingTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
            <span
              className={clsx('uppercase', busy ? 'text-[#1c69d4]' : showApproval ? 'text-[#262626]' : 'text-[#bbbbbb]')}
              style={{
                fontSize: 12,
                fontWeight: 400,
                letterSpacing: '0.15em',
              }}
            >
              {STATE_LABELS[state]}
            </span>
            {slug && (
              <span
                className="uppercase"
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  color: '#262626',
                }}
              >
                Discussion: {slug}
              </span>
            )}
            <button
              onClick={onNewDiscussion}
              disabled={!canStartNewDiscussion}
              className={clsx(
                'uppercase transition-colors',
                canStartNewDiscussion
                  ? 'text-[#262626] hover:text-[#1c69d4]'
                  : 'text-[#bbbbbb] cursor-not-allowed',
              )}
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.15em',
                padding: '4px 0',
                borderBottom: '1px solid currentColor',
                background: 'transparent',
              }}
              title={
                !slug
                  ? 'No active discussion to archive — submit one first'
                  : busy
                    ? 'Wait for the current round to finish'
                    : 'Archive this discussion and start a new topic'
              }
            >
              New Discussion
            </button>
          </div>
        </div>

        {state !== 'idle' && (
          <div style={{ marginTop: 32 }}>
            <DiscussProgress state={state} />
          </div>
        )}

        {idea && (
          <p
            className="truncate"
            style={{ marginTop: 24, fontSize: 14, fontWeight: 400, color: '#757575', lineHeight: 1.3 }}
          >
            › {idea}
          </p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0" style={{ padding: '40px 60px', gap: 32 }}>
        {/* Explanation when idle */}
        {state === "idle" && lines.length === 0 && (
          <div style={{ maxWidth: 720 }}>
            <h2
              className="uppercase"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: '0.15em',
                color: '#262626',
                marginBottom: 16,
              }}
            >
              How warzone works
            </h2>
            <ol style={{ fontSize: 16, fontWeight: 400, color: '#262626', lineHeight: 1.5, paddingLeft: 24 }}>
              <li>Claude frames the idea as a planner — picks a slug for the topic and writes <code>&lt;slug&gt;-WarZone.md</code></li>
              <li>Gemini proposes a build approach (stack, steps, concerns)</li>
              <li>Codex audits both takes and pokes holes</li>
              <li>You review the discussion, then approve</li>
              <li>Submit again to add to the same topic, or click <em>New Discussion</em> to archive and start fresh</li>
            </ol>
          </div>
        )}

        {/* During busy phases: raw log. On complete: pretty-printed markdown review. */}
        {showApproval ? (
          <DiscussionReview refreshKey={state} />
        ) : (
          lines.length > 0 && <DiscussionPanel lines={lines} droppedLineCount={droppedLineCount} />
        )}

        {/* Approval */}
        {showApproval && (
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
              Discussion ready
            </h2>
            <p style={{ fontSize: 16, fontWeight: 400, color: '#757575', lineHeight: 1.3, marginBottom: 32 }}>
              All three agents have written their takes. Approve to keep this discussion open — submit again to add another round on the same topic, or click <em>New Discussion</em> in the header to archive and switch topics.
            </p>
            <div className="flex items-center" style={{ gap: 16 }}>
              <button
                onClick={onApprove}
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: 1.2,
                  letterSpacing: '0.05em',
                  padding: '16px 32px',
                }}
              >
                Approve →
              </button>
              <button
                onClick={onAbort}
                className="uppercase"
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  lineHeight: 1.15,
                  letterSpacing: '0.05em',
                  padding: '16px 0 12px',
                  borderBottom: '1px solid currentColor',
                }}
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
              placeholder={
                slug
                  ? `Add another round to "${slug}" (or click New Discussion above for a different topic)`
                  : 'What do you want to discuss? (e.g. build a real-time dashboard for Argus)'
              }
              rows={3}
              className="w-full outline-none resize-none"
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
            <div
              className="flex items-center justify-between"
              style={{ marginTop: 20 }}
            >
              <p
                className="uppercase"
                style={{ fontSize: 12, color: '#757575', letterSpacing: '0.15em' }}
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
                  letterSpacing: '0.05em',
                  padding: '16px 32px',
                }}
              >
                {slug ? 'Add Round →' : 'Start Discussion →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
