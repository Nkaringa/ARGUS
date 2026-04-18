import { useEffect, useRef, useState, useCallback } from 'react';
import { SERVERS, authHeaders, wsUrl } from '../config';
import type { BuildState, OutputLine, HistoryItem } from '../types';

export function useBuildSocket() {
  const [state, setState] = useState<BuildState>('idle');
  const [task, setTask] = useState<string | null>(null);
  const [iteration, setIteration] = useState(0);
  const [grade, setGrade] = useState<string | undefined>(undefined);
  const [lines, setLines] = useState<OutputLine[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    const ws = new WebSocket(wsUrl(SERVERS.build.ws));
    wsRef.current = ws;
    let closed = false;

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'state') {
        setState(msg.state);
        if (msg.task !== undefined) setTask(msg.task);
        if (msg.iteration !== undefined) setIteration(msg.iteration);
        if (msg.grade !== undefined) setGrade(msg.grade);
      }

      if (msg.type === 'output') {
        setLines((prev) => [...prev, { agent: msg.agent, line: msg.line }]);
      }

      if (msg.type === 'log_replay') {
        setLines(msg.lines);
      }

      if (msg.type === 'history') {
        setHistory(msg.items ?? []);
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

  const submitTask = useCallback(async (description: string) => {
    const res = await fetch(`${SERVERS.build.http}/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ description }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    setLines([]);
  }, []);

  const sendApproval = useCallback(async (action: 'approve' | 'skip' | 'retry' | 'abort') => {
    const res = await fetch(`${SERVERS.build.http}/approval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    if (action === 'approve') setLines([]);
  }, []);

  const stop = useCallback(async () => {
    const res = await fetch(`${SERVERS.build.http}/stop`, { method: 'POST', headers: authHeaders() });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    setLines([]);
  }, []);

  return { state, task, iteration, grade, lines, history, submitTask, sendApproval, stop };
}
