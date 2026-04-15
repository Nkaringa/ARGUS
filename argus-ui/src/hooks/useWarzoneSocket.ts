import { useEffect, useRef, useState, useCallback } from 'react';
import { SERVERS, authHeaders, wsUrl } from '../config';
import type { WarzoneState, OutputLine } from '../types';

export function useWarzoneSocket() {
  const [state, setState] = useState<WarzoneState>('idle');
  const [idea, setIdea] = useState<string | null>(null);
  const [lines, setLines] = useState<OutputLine[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    const ws = new WebSocket(wsUrl(SERVERS.warzone.ws));
    wsRef.current = ws;
    let closed = false;

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'state') {
        setState(msg.state);
        if (msg.idea !== undefined) setIdea(msg.idea);
      }

      if (msg.type === 'output') {
        setLines((prev) => [...prev, { agent: msg.agent, line: msg.line }]);
      }

      if (msg.type === 'log_replay') {
        setLines(msg.lines);
      }
    };

    ws.onclose = () => {
      if (!closed) setTimeout(() => connectRef.current(), 2000);
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

  const submitIdea = useCallback(async (idea: string) => {
    const res = await fetch(`${SERVERS.warzone.http}/discuss`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ idea }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    setLines([]);
  }, []);

  const sendApproval = useCallback(async (action: 'approve' | 'abort') => {
    const res = await fetch(`${SERVERS.warzone.http}/discuss/approval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
  }, []);

  const stop = useCallback(async () => {
    const res = await fetch(`${SERVERS.warzone.http}/stop`, { method: 'POST', headers: authHeaders() });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    setLines([]);
  }, []);

  return { state, idea, lines, submitIdea, sendApproval, stop };
}
