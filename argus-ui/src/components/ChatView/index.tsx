import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import type { AgentKey, ChatMessage } from '../../types';

interface ChatViewProps {
  agent: AgentKey;
  agentLabel: string;
  messages: ChatMessage[];
  onSend: (agent: AgentKey, prompt: string) => void;
}

function MessageBlock({ message, agentLabel }: { message: ChatMessage; agentLabel: string }) {
  const isUser = message.role === 'user';
  const author = isUser ? 'You' : agentLabel;
  return (
    <div style={{ padding: '24px 0', borderBottom: '1px solid #bbbbbb' }}>
      <p
        className="uppercase"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          fontWeight: 900,
          letterSpacing: '0.15em',
          color: isUser ? '#757575' : '#262626',
          marginBottom: 8,
        }}
      >
        {author}
      </p>
      <p
        className="whitespace-pre-wrap break-words"
        style={{
          fontSize: 16,
          fontWeight: 400,
          lineHeight: 1.3,
          color: '#262626',
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
    <div className="flex flex-col h-full bg-white text-[#262626]">
      {/* Header */}
      <div className="shrink-0" style={{ padding: '48px 60px 32px', borderBottom: '1px solid #bbbbbb' }}>
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
          Chat — {agentLabel}
        </h1>
        <p style={{ fontSize: 14, fontWeight: 400, color: '#757575', marginTop: 8 }}>
          Direct conversation — no pipeline
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '0 60px' }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center" style={{ gap: 16 }}>
            <p
              className="uppercase"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 32,
                fontWeight: 300,
                letterSpacing: '0.02em',
                color: '#262626',
              }}
            >
              Start a conversation with {agentLabel}
            </p>
            <p
              className="uppercase"
              style={{ fontSize: 12, color: '#757575', letterSpacing: '0.15em' }}
            >
              Shift + Enter for new line · Enter to send
            </p>
          </div>
        ) : (
          messages.map((msg, i) => <MessageBlock key={i} message={msg} agentLabel={agentLabel} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0" style={{ padding: '24px 60px 40px', borderTop: '1px solid #bbbbbb' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${agentLabel}...`}
          rows={1}
          className="w-full bg-transparent outline-none resize-none"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 16,
            fontWeight: 400,
            color: '#262626',
            lineHeight: 1.3,
            padding: '12px 0',
            borderBottom: '1px solid #262626',
            minHeight: 48,
            maxHeight: 160,
          }}
          onInput={(e) => {
            const t = e.currentTarget;
            t.style.height = 'auto';
            t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
          }}
          onFocus={(e) => (e.currentTarget.style.borderBottom = '2px solid #1c69d4')}
          onBlur={(e) => (e.currentTarget.style.borderBottom = '1px solid #262626')}
        />
        <div className="flex items-center justify-between" style={{ marginTop: 16 }}>
          <p
            className="uppercase"
            style={{ fontSize: 12, color: '#757575', letterSpacing: '0.15em' }}
          >
            Shift + Enter for new line
          </p>
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className={
              !input.trim()
                ? 'uppercase border border-[#bbbbbb] text-[#bbbbbb] cursor-not-allowed'
                : 'uppercase bg-[#1c69d4] text-white border border-[#1c69d4] hover:bg-[#0653b6] hover:border-[#0653b6] transition-colors'
            }
            style={{
              fontSize: 16,
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: '0.05em',
              padding: '12px 24px',
            }}
          >
            Send →
          </button>
        </div>
      </div>
    </div>
  );
}
