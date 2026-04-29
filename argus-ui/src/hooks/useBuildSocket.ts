import { useEffect, useRef, useState, useCallback } from 'react';
import { SERVERS, authHeaders, wsUrl } from '../config';
import type { BuildState, OutputLine, HistoryItem } from '../types';

export interface SubmitOpts {
  mode: 'new' | 'continue';
  slug?: string;
  autoApprove?: boolean;
  autoApproveCap?: number;
}

// Cap the in-memory log buffer client-side. The line splitter on the backend now publishes
// per-actual-line (vs occasional megabyte chunks before), so a long build can produce
// thousands of lines. Without a cap, React state grows unbounded. 500 lines is plenty for
// live monitoring; deep scrollback is a virtualization story (see plan/follow-ups).
const MAX_LINES = 500;

export function useBuildSocket() {
  const [state, setState] = useState<BuildState>('idle');
  const [task, setTask] = useState<string | null>(null);
  const [iteration, setIteration] = useState(0);
  const [grade, setGrade] = useState<string | undefined>(undefined);
  const [slug, setSlug] = useState<string | null>(null);
  const [autoApprove, setAutoApprove] = useState(false);
  const [autoApproveCap, setAutoApproveCap] = useState(10);
  const [lines, setLines] = useState<OutputLine[]>([]);
  const [droppedLineCount, setDroppedLineCount] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  // Timestamp of the last state transition. Lives in the hook (not BuildView) so
  // the elapsed-time display survives tab switches — otherwise unmounting the
  // view resets the counter to 0.
  const [stageStartedAt, setStageStartedAt] = useState<number>(() => Date.now());
  const wsRef = useRef<WebSocket | null>(null);
  const connectRef = useRef<() => void>(() => {});
  // Reconnect attempt counter for exponential backoff. Resets to 0 on successful
  // connection (onopen). Without this, a fixed 2s retry would hammer the server
  // thousands of times during an extended hermes outage.
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    const ws = new WebSocket(wsUrl(SERVERS.build.ws));
    wsRef.current = ws;
    let closed = false;

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'state') {
        setState((prev) => {
          if (prev !== msg.state) setStageStartedAt(Date.now());
          return msg.state;
        });
        if (msg.task !== undefined) setTask(msg.task);
        if (msg.iteration !== undefined) setIteration(msg.iteration);
        if (msg.grade !== undefined) setGrade(msg.grade);
        if (msg.slug !== undefined) setSlug(msg.slug);
        if (msg.autoApprove !== undefined) setAutoApprove(msg.autoApprove);
        if (msg.autoApproveCap !== undefined) setAutoApproveCap(msg.autoApproveCap);
      }

      if (msg.type === 'output') {
        setLines((prev) => {
          if (prev.length < MAX_LINES) {
            return [...prev, { agent: msg.agent, line: msg.line }];
          }
          // Cap reached: drop the oldest. Track the drop so the UI can surface
          // "showing last N of M" instead of silently lying about scrollback depth.
          setDroppedLineCount((c) => c + 1);
          return [...prev.slice(-(MAX_LINES - 1)), { agent: msg.agent, line: msg.line }];
        });
      }

      if (msg.type === 'log_replay') {
        // Server-side replay buffer maxes at 100. Anything dropped server-side isn't
        // visible to us; reset the UI drop counter to honestly reflect what we know.
        setLines(msg.lines);
        setDroppedLineCount(0);
      }

      if (msg.type === 'history') {
        setHistory(msg.items ?? []);
      }
    };

    ws.onclose = () => {
      if (closed) return;
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s, then capped at 30s.
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

  // Refresh on mount + after each idle/done transition. setState is called inside
  // the fetch's .then() callback (post-await), so it's not synchronous within the
  // effect body — satisfies react-hooks/set-state-in-effect without suppression.
  useEffect(() => {
    if (state !== 'idle' && state !== 'done') return;
    let cancelled = false;
    fetch(`${SERVERS.build.http}/projects`, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled || !body) return;
        setProjects(Array.isArray(body.projects) ? body.projects : []);
      })
      .catch(() => { /* silent — selector just won't populate */ });
    return () => { cancelled = true; };
  }, [state]);

  const submitTask = useCallback(async (description: string, opts?: SubmitOpts) => {
    const body: Record<string, unknown> = { description };
    if (opts?.mode === 'continue' && opts.slug) {
      body.mode = 'continue';
      body.slug = opts.slug;
    }
    if (opts?.autoApprove) {
      body.autoApprove = true;
      if (typeof opts.autoApproveCap === 'number' && opts.autoApproveCap > 0) {
        body.autoApproveCap = opts.autoApproveCap;
      }
    }
    const res = await fetch(`${SERVERS.build.http}/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errBody.error || `Request failed (${res.status})`);
    }
    setLines([]);
    setDroppedLineCount(0);
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
    if (action === 'approve') {
      setLines([]);
      setDroppedLineCount(0);
    }
  }, []);

  const stop = useCallback(async () => {
    const res = await fetch(`${SERVERS.build.http}/stop`, { method: 'POST', headers: authHeaders() });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    setLines([]);
    setDroppedLineCount(0);
  }, []);

  return { state, task, iteration, grade, slug, autoApprove, autoApproveCap, stageStartedAt, lines, droppedLineCount, history, projects, submitTask, sendApproval, stop };
}
