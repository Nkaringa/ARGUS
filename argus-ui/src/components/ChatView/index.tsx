import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AgentKey, ChatMessage } from '../../types';
import { Panel, ActionButton } from '../shared/Panel';
import { markdownComponents } from '../shared/markdownComponents';

interface ChatViewProps {
  agent: AgentKey;
  agentLabel: string;
  messages: ChatMessage[];
  onSend: (agent: AgentKey, prompt: string) => void;
}

// Per-agent color + role label. Matches the sidebar and the Build view so a user
// scanning any screen sees the same agent identity.
const AGENT_META: Record<AgentKey, { key: 'claude' | 'gemini' | 'codex'; color: string; role: string }> = {
  planner:        { key: 'claude', color: 'var(--claude)', role: 'planner' },
  builder:        { key: 'gemini', color: 'var(--gemini)', role: 'builder' },
  codex_auditor:  { key: 'codex',  color: 'var(--codex)',  role: 'auditor' },
};

/* ────────────────────────────── breadcrumbs ────────────────────────────── */

function Breadcrumbs({ agentKey }: { agentKey: string }) {
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
      <span style={{ color: 'var(--ink)' }}>chat</span>
      <span style={{ color: 'var(--rule-hot)' }}>/</span>
      <span style={{ color: 'var(--accent)' }}>{agentKey}</span>
      <span style={{ color: 'var(--ink-dim)', fontSize: 10, marginLeft: 'auto' }}>
        ws <b style={{ color: 'var(--accent)', fontWeight: 500 }}>3001</b> connected · direct — no pipeline
      </span>
    </div>
  );
}

/* ────────────────────────────── hero ────────────────────────────── */

function HeroCard({
  agentKey,
  agentColor,
  role,
  messageCount,
}: {
  agentKey: string;
  agentColor: string;
  role: string;
  messageCount: number;
}) {
  return (
    <section
      style={{
        marginTop: 20,
        border: '1px solid var(--rule)',
        background: 'var(--bg-2)',
        padding: '22px 26px',
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 24,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.18em',
            color: 'var(--ink-dimmer)',
            textTransform: 'uppercase',
          }}
        >
          // direct chat · [ {role} ] · no pipeline
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px, 4.8vw, 56px)',
            fontWeight: 500,
            lineHeight: 1,
            letterSpacing: '-0.03em',
            marginTop: 10,
            color: agentColor,
          }}
        >
          {agentKey}
        </h1>
      </div>
      <div style={{ display: 'flex', gap: 32, alignItems: 'baseline' }}>
        <Stat label="messages" value={String(messageCount)} />
        <Stat label="agent" value={agentKey} mono />
      </div>
    </section>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
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
        {label}
      </div>
      <div
        style={{
          fontFamily: mono ? 'var(--font-body)' : 'var(--font-display)',
          fontSize: mono ? 14 : 20,
          fontWeight: 500,
          color: 'var(--ink)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}

/* ────────────────────────────── message block ────────────────────────────── */

function MessageBlock({
  message,
  agentKey,
  agentColor,
  role,
}: {
  message: ChatMessage;
  agentKey: string;
  agentColor: string;
  role: string;
}) {
  const isUser = message.role === 'user';
  return (
    <div
      style={{
        padding: '18px 22px',
        borderBottom: '1px dashed var(--rule)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: isUser ? 'var(--ink)' : agentColor,
          }}
        >
          {isUser ? 'you' : agentKey}
        </span>
        {!isUser && (
          <span
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              color: 'var(--ink-dim)',
              textTransform: 'uppercase',
            }}
          >
            [ {role} ]
          </span>
        )}
      </div>
      {isUser ? (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            lineHeight: 1.6,
            color: 'var(--ink)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: 0,
          }}
        >
          {message.text}
        </p>
      ) : (
        <div className="markdown-body" style={{ color: 'var(--ink)' }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {message.text}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────── empty state ────────────────────────────── */

function EmptyState({
  agentKey,
  agentColor,
  role,
}: {
  agentKey: string;
  agentColor: string;
  role: string;
}) {
  return (
    <div
      style={{
        padding: '60px 22px',
        textAlign: 'center',
        color: 'var(--ink-dim)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 26,
          fontWeight: 500,
          color: 'var(--ink)',
          marginBottom: 8,
          letterSpacing: '-0.02em',
        }}
      >
        start a conversation with{' '}
        <span style={{ color: agentColor }}>{agentKey}</span>
      </div>
      <div
        style={{
          fontSize: 12,
          letterSpacing: '0.1em',
          color: 'var(--ink-dimmer)',
          textTransform: 'uppercase',
          marginBottom: 20,
        }}
      >
        [ {role} ] · no pipeline · no role doc
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--ink-dim)',
          lineHeight: 1.6,
          maxWidth: '56ch',
          margin: '0 auto',
        }}
      >
        this is a direct prompt to {agentKey}. messages here don't enter the build or warzone pipelines — there's no plan, no grade, no state machine. good for quick questions, scoping, or debugging ideas.
      </div>
    </div>
  );
}

/* ────────────────────────────── main view ────────────────────────────── */

export function ChatView({ agent, agentLabel, messages, onSend }: ChatViewProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const meta = AGENT_META[agent];
  const agentKey = meta.key;
  const agentColor = meta.color;

  void agentLabel; // agentLabel is derived from agent.key now; retained for API symmetry.

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    onSend(agent, text);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
      <Breadcrumbs agentKey={agentKey} />

      <HeroCard
        agentKey={agentKey}
        agentColor={agentColor}
        role={meta.role}
        messageCount={messages.length}
      />

      {/* Thread — Panel uses `fill` so it claims the remaining height in this
          flex-column. Messages scroll inside the body div; input stays pinned below. */}
      <div style={{ marginTop: 18, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Panel
          fill
          headLabel="thread"
          headRight={`${messages.length} message${messages.length === 1 ? '' : 's'}`}
        >
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              padding: 0,
            }}
          >
            {messages.length === 0 ? (
              <EmptyState agentKey={agentKey} agentColor={agentColor} role={meta.role} />
            ) : (
              messages.map((msg, i) => (
                <MessageBlock
                  key={i}
                  message={msg}
                  agentKey={agentKey}
                  agentColor={agentColor}
                  role={meta.role}
                />
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </Panel>
      </div>

      {/* Input — terminal-style prompt row */}
      <div style={{ marginTop: 18, flexShrink: 0 }}>
        <Panel headLabel={`reply to ${agentKey}`} headRight="direct — no state machine">
          <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
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
                placeholder={`message ${agentKey}...`}
                rows={2}
                style={{
                  resize: 'none',
                  fontSize: 13,
                  lineHeight: 1.55,
                  color: 'var(--ink)',
                  width: '100%',
                }}
                onInput={(e) => {
                  const t = e.currentTarget;
                  t.style.height = 'auto';
                  t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
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
                ⏎ send · ⇧⏎ newline
              </span>
              <ActionButton primary onClick={handleSend} disabled={!input.trim()}>
                send →
              </ActionButton>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
