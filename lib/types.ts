export type ProviderTransform = 'openai' | 'anthropic';

export interface ProviderKey {
  providerId: string;
  apiKey: string;
  baseUrl?: string;
  models: string[];
  selectedModel?: string;
  status: 'idle' | 'loading' | 'ok' | 'error';
  error?: string;
  useProxy?: boolean;
  lastChecked?: number;
}

export type AgentRole = 'director' | 'scout' | 'builder' | 'critic' | 'executor';

export interface AgentConfig {
  id: string;
  name: string;
  providerId: string;
  model: string;
  role: AgentRole;
  isDirector: boolean;
  enabled: boolean;
  temperature: number;
}

export interface Target {
  id: string;
  url: string;
  note?: string;
}

export type EventKind =
  | 'system' | 'plan' | 'text' | 'tool' | 'tool_result'
  | 'error' | 'verdict' | 'report' | 'final';

export interface BBEvent {
  id: string;
  ts: number;
  round: number;
  agentId: string;
  agentName: string;
  providerId: string;
  model: string;
  kind: EventKind;
  tool?: string;
  content: string;
  meta?: Record<string, unknown>;
}

export interface RunConfig {
  maxRounds: number;
  maxToolCalls: number;
  maxToolCallsPerTurn: number;
  searchProvider: 'duckduckgo' | 'serper' | 'brave' | 'tavily';
  searchKey: string;
  goalCheckEveryRound: boolean;
}

export interface AgentRuntime {
  id: string;
  status: 'idle' | 'thinking' | 'tool' | 'reporting' | 'done' | 'error' | 'offline';
  lastAction: string;
  tokensIn: number;
  tokensOut: number;
  calls: number;
  errors: number;
}

export interface VFile {
  path: string;
  content: string;
  mtime: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LLMResponse {
  content: string;
  tool_calls: ToolCall[];
  usage?: { input: number; output: number };
  raw?: unknown;
}
