import { useEffect, useRef, useState, useCallback } from 'react';
import { SERVERS, authHeaders, wsUrl } from '../config';
import type { WarzoneState, OutputLine } from '../types';

// Same client-side cap as useBuildSocket — see comment there for rationale.
const MAX_LINES = 500;

export function useWarzoneSocket() {
  const [state, setState] = useState<WarzoneState>('idle');
  const [idea, setIdea] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [lines, setLines] = useState<OutputLine[]>([]);
  const [droppedLineCount, setDroppedLineCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const connectRef = useRef<() => void>(() => {});
  // Exponential backoff for reconnect — see useBuildSocket for rationale.
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    const ws = new WebSocket(wsUrl(SERVERS.warzone.ws));
    wsRef.current = ws;
    let closed = false;

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'state') {
        setState(msg.state);
        if (msg.idea !== undefined) setIdea(msg.idea);
        if (msg.slug !== undefined) setSlug(msg.slug);
      }

      if (msg.type === 'output') {
        setLines((prev) => {
          if (prev.length < MAX_LINES) {
            return [...prev, { agent: msg.agent, line: msg.line }];
          }
          setDroppedLineCount((c) => c + 1);
          return [...prev.slice(-(MAX_LINES - 1)), { agent: msg.agent, line: msg.line }];
        });
      }

      if (msg.type === 'log_replay') {
        setLines(msg.lines);
        setDroppedLineCount(0);
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
    setDroppedLineCount(0);
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
    setDroppedLineCount(0);
  }, []);

  const newDiscussion = useCallback(async () => {
    const res = await fetch(`${SERVERS.warzone.http}/warzone/new-discussion`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    setLines([]);
    setDroppedLineCount(0);
  }, []);

  return { state, idea, slug, lines, droppedLineCount, submitIdea, sendApproval, stop, newDiscussion };
}
