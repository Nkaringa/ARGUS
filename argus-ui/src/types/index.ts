export type AgentKey = 'builder' | 'planner' | 'codex_auditor';

export type Section = 'chat-gemini' | 'chat-claude' | 'chat-codex' | 'build' | 'warzone' | 'logs' | 'archive';

export interface HistoryEntry {
  slug: string;
  mtime: number;
}

export interface BuildArchive {
  plan: string;
  buildLog: string;
  buildFeedback: string;
}

export interface DiscussionArchive {
  warzone: string;
}

export type BuildState =
  | 'idle'
  | 'planning'
  | 'awaiting_plan_review'
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
  slug: string | null;
  lines: OutputLine[];
}
