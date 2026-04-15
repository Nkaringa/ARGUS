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
  const order = ['idle', 'discussing_claude', 'discussing_gemini', 'discussing_codex', 'awaiting_discuss_approval'];
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
                background: done || active ? '#1c69d4' : '#bbbbbb',
                marginRight: 2,
              }}
            />
          );
        })}
      </div>
      <div className="flex w-full mt-2">
        {steps.map((step) => {
          const stepIdx = order.indexOf(step.key);
          const done = currentIdx > stepIdx;
          const active = state === step.key;
          return (
            <span
              key={step.key}
              className="flex-1 uppercase"
              style={{
                fontSize: 12,
                fontWeight: 400,
                letterSpacing: '0.15em',
                color: done || active ? '#262626' : '#bbbbbb',
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
        background: '#262626',
        color: '#ffffff',
        padding: 32,
        fontFamily: 'var(--font-body)',
        fontSize: 14,
        lineHeight: 1.3,
      }}
    >
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

export function WarzoneView({ state, idea, lines, onSubmit, onApprove, onAbort }: WarzoneViewProps) {
  const [input, setInput] = useState('');
  const busy = state === 'discussing_claude' || state === 'discussing_gemini' || state === 'discussing_codex';
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
              Warzone
            </h1>
            <p style={{ fontSize: 14, fontWeight: 400, color: '#757575', marginTop: 8 }}>
              Sequential agent discussion
            </p>
          </div>
          <span
            className={clsx('uppercase', busy ? 'text-[#1c69d4]' : showApproval ? 'text-[#262626]' : 'text-[#bbbbbb]')}
            style={{
              fontSize: 12,
              fontWeight: 400,
              letterSpacing: '0.15em',
              paddingTop: 24,
            }}
          >
            {STATE_LABELS[state]}
          </span>
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
            {idea}
          </p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col min-h-0" style={{ padding: '40px 60px', gap: 32 }}>
        {/* Explanation when idle */}
        {state === 'idle' && lines.length === 0 && (
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
              How Warzone Works
            </h2>
            <ol style={{ fontSize: 16, fontWeight: 400, color: '#262626', lineHeight: 1.5, paddingLeft: 24 }}>
              <li>Claude frames the idea as a planner (files, approach, gotchas)</li>
              <li>Gemini proposes a build approach (stack, steps, concerns)</li>
              <li>Codex audits both takes and pokes holes</li>
              <li>You review WarZone.md, then approve</li>
              <li>Take the discussion to Build and reference WarZone.md in your prompt</li>
            </ol>
          </div>
        )}

        {/* During the three agent phases, stream raw log output.
            When the discussion completes, swap to the pretty-printed markdown review. */}
        {showApproval ? (
          <DiscussionReview refreshKey={state} />
        ) : (
          lines.length > 0 && <DiscussionPanel lines={lines} />
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
              Discussion Ready
            </h2>
            <p style={{ fontSize: 16, fontWeight: 400, color: '#757575', lineHeight: 1.3, marginBottom: 32 }}>
              All three agents have written their takes. Approve to save WarZone.md as a reference, then use it in Build.
            </p>
            <div className="flex items-center" style={{ gap: 24 }}>
              <button
                onClick={onApprove}
                className="uppercase bg-[#1c69d4] text-white border border-[#1c69d4] hover:bg-[#0653b6] hover:border-[#0653b6] transition-colors"
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  letterSpacing: '0.05em',
                  padding: '16px 32px',
                }}
              >
                Approve →
              </button>
              <button
                onClick={onAbort}
                className="uppercase text-[#262626] hover:text-[#1c69d4] transition-colors"
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
              placeholder="What do you want to discuss? (e.g. build a real-time dashboard for Argus)"
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
                Enter to submit · Shift + Enter for new line
              </p>
              <button
                onClick={handleSubmit}
                disabled={!input.trim()}
                className={
                  !input.trim()
                    ? 'uppercase border border-[#bbbbbb] text-[#bbbbbb] cursor-not-allowed bg-transparent'
                    : 'uppercase bg-[#1c69d4] text-white border border-[#1c69d4] hover:bg-[#0653b6] hover:border-[#0653b6] transition-colors'
                }
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  letterSpacing: '0.05em',
                  padding: '16px 32px',
                }}
              >
                Start Discussion →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
