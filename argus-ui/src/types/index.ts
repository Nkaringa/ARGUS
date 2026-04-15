export type AgentKey = 'builder' | 'planner' | 'codex_auditor';

export type Section = 'chat-gemini' | 'chat-claude' | 'chat-codex' | 'build' | 'warzone' | 'logs';

export type BuildState =
  | 'idle'
  | 'planning'
  | 'building'
  | 'auditing'
  | 'awaiting_approval'
  | 'paused'
  | 'done';

export type WarzoneState =
  | 'idle'
  | 'discussing_claude'
  | 'discussing_gemini'
  | 'discussing_codex'
  | 'awaiting_discuss_approval';

export interface OutputLine {
  agent: string;
  line: string;
}

export interface ChatMessage {
  role: 'user' | 'agent';
  text: string;
}

export interface HistoryItem {
  id: number;
  description: string;
  status: string;
  grade: string | null;
  iterations: number;
  created_at: string;
}

export interface BuildSocketState {
  state: BuildState;
  task: string | null;
  iteration: number;
  grade?: string;
  lines: OutputLine[];
  history: HistoryItem[];
}

export interface WarzoneSocketState {
  state: WarzoneState;
  idea: string | null;
  lines: OutputLine[];
}
