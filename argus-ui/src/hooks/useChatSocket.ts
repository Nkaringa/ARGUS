import { useEffect, useRef, useState, useCallback } from 'react';
import { SERVERS, authHeaders, wsUrl } from '../config';
import type { AgentKey, ChatMessage } from '../types';

export function useChatSocket() {
  const [geminiMessages, setGeminiMessages] = useState<ChatMessage[]>([]);
  const [claudeMessages, setClaudeMessages] = useState<ChatMessage[]>([]);
  const [codexMessages, setCodexMessages] = useState<ChatMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const connectRef = useRef<() => void>(() => {});
  // Exponential backoff for reconnect — see useBuildSocket for rationale.
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    const ws = new WebSocket(wsUrl(SERVERS.chat.ws));
    wsRef.current = ws;
    let closed = false;

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'chat_output') {
        const setter =
          msg.agent === 'builder' ? setGeminiMessages :
          msg.agent === 'planner' ? setClaudeMessages :
          msg.agent === 'codex_auditor' ? setCodexMessages :
          null;
        if (!setter) return;
        setter((prev) => {
          // Append to last agent bubble if it already exists, else create new
          if (prev.length > 0 && prev[prev.length - 1].role === 'agent') {
            return [
              ...prev.slice(0, -1),
              { role: 'agent', text: prev[prev.length - 1].text + '\n' + msg.line },
            ];
          }
          return [...prev, { role: 'agent', text: msg.line }];
        });
      }
    };

    ws.onclose = () => {
      if (closed) return;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
      reconnectAttemptsRef.current++;
      setTimeout(() => connectRef.current(), delay);
    };

    return () => {
      closed = true;
      ws.close();
    };
  }, []);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);

  const geminiMessagesRef = useRef<ChatMessage[]>([]);
  const claudeMessagesRef = useRef<ChatMessage[]>([]);
  const codexMessagesRef = useRef<ChatMessage[]>([]);

  useEffect(() => { geminiMessagesRef.current = geminiMessages; }, [geminiMessages]);
  useEffect(() => { claudeMessagesRef.current = claudeMessages; }, [claudeMessages]);
  useEffect(() => { codexMessagesRef.current = codexMessages; }, [codexMessages]);

  const sendMessage = useCallback(async (agent: AgentKey, prompt: string) => {
    const setter =
      agent === 'builder' ? setGeminiMessages :
      agent === 'planner' ? setClaudeMessages :
      setCodexMessages;
    const history =
      agent === 'builder' ? geminiMessagesRef.current :
      agent === 'planner' ? claudeMessagesRef.current :
      codexMessagesRef.current;
    setter((prev) => [...prev, { role: 'user', text: prompt }]);

    const res = await fetch(`${SERVERS.chat.http}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ agent, prompt, history }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
  }, []);

  return { geminiMessages, claudeMessages, codexMessages, sendMessage };
}
