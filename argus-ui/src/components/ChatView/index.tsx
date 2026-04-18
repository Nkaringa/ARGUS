import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import type { AgentKey, ChatMessage } from '../../types';

interface ChatViewProps {
  agent: AgentKey;
  agentLabel: string;
  messages: ChatMessage[];
  onSend: (agent: AgentKey, prompt: string) => void;
}

function MessageBlock({
  message,
  agentLabel,
}: {
  message: ChatMessage;
  agentLabel: string;
}) {
  const isUser = message.role === 'user';
  const author = isUser ? 'you' : agentLabel.toLowerCase();
  return (
    <div
      style={{
        padding: '20px 0',
        borderBottom: '1px solid var(--color-ink-3)',
      }}
    >
      <p
        className="uppercase"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: '0.15em',
          color: isUser ? 'var(--color-fg-2)' : 'var(--color-accent)',
          margin: 0,
          marginBottom: 8,
        }}
      >
        [{author}]
      </p>
      <p
        className="whitespace-pre-wrap break-words"
        style={{
          fontSize: 15,
          fontWeight: 400,
          lineHeight: 1.55,
          color: 'var(--color-fg-0)',
          margin: 0,
        }}
      >
        {message.text}
      </p>
    </div>
  );
}

export function ChatView({ agent, agentLabel, messages, onSend }: ChatViewProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

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
          Chat · {agentLabel.toLowerCase()}
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
          {agentLabel}
        </h1>
        <p
          style={{
            fontSize: 14,
            fontWeight: 400,
            color: 'var(--color-fg-1)',
            marginTop: 8,
          }}
        >
          Direct conversation — no pipeline.
        </p>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ padding: '0 60px' }}
      >
        {messages.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-full text-center"
            style={{ gap: 12 }}
          >
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 20,
                fontWeight: 400,
                color: 'var(--color-fg-1)',
                margin: 0,
              }}
            >
              Start a conversation with {agentLabel}.
            </p>
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
              Shift + Enter for new line · Enter to send
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <MessageBlock key={i} message={msg} agentLabel={agentLabel} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="shrink-0"
        style={{
          padding: '24px 60px 32px',
          borderTop: '1px solid var(--color-ink-3)',
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${agentLabel}...`}
          rows={1}
          className="w-full outline-none resize-none"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 15,
            fontWeight: 400,
            color: 'var(--color-fg-0)',
            lineHeight: 1.55,
            padding: '10px 0',
            background: 'transparent',
            borderBottom: '1px solid var(--color-ink-3)',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            minHeight: 44,
            maxHeight: 160,
            transition: 'border-color 150ms ease-out',
          }}
          onInput={(e) => {
            const t = e.currentTarget;
            t.style.height = 'auto';
            t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
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
          style={{ marginTop: 14 }}
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
            Shift + Enter for new line
          </p>
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            style={{
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.2,
              letterSpacing: '0.02em',
              padding: '10px 20px',
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
            Send →
          </button>
        </div>
      </div>
    </div>
  );
}
