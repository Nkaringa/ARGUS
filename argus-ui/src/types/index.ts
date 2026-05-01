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
  // Stamped client-side when the message is appended (user submit or first
  // streamed chunk for an agent). Powers the "Xm ago" line under each message.
  ts: number;
}

export interface HistoryItem {
  id: number;
  description: string;
  status: string;
  grade: string | null;
  iterations: number;
  created_at: string;
  completed_at: string | null;  // null while RUNNING; ISO timestamp once sealed
}

// Aggregated metadata for a single task — powers the click-to-expand row on
// /logs. Fetched lazily via GET /tasks/:id/detail. The shape mirrors what
// hermes/core/db.js#getTaskDetail produces.
export interface TaskDetail {
  slug: string | null;
  mode: 'new' | 'continue' | null;
  autoApprove: boolean;
  autoApproveCap: number | null;
  planReview: boolean;
  gradeTrail: { iteration: number; grade: string }[];
  agentTotals: { claude: number; gemini: number; codex: number };  // total durationMs per agent
  files: { name: string; sizeBytes: number; role: string }[];
  failures: { role: string | null; error: string | null }[];
  truncated: boolean;  // true if event scan hit the 1000-event safety cap
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
