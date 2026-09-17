import type { ProviderTransform } from './types';

export interface ProviderDef {
  id: string;
  name: string;
  baseUrl: string;
  modelsUrl?: string;
  docsUrl: string;
  auth: 'bearer' | 'x-api-key' | 'none';
  transform: ProviderTransform;
  accent: string;
  keyless?: boolean;
  direct?: boolean;
  extraHeaders?: Record<string, string>;
  fallbackModels?: string[];
  note?: string;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1',
    docsUrl: 'https://platform.openai.com/api-keys', auth: 'bearer', transform: 'openai',
    accent: '#7dff9b', direct: true,
    fallbackModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o4-mini'],
  },
  {
    id: 'anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1',
    docsUrl: 'https://console.anthropic.com/settings/keys', auth: 'x-api-key', transform: 'anthropic',
    accent: '#ffb454', direct: true,
    extraHeaders: { 'anthropic-dangerous-direct-browser-access': 'true' },
    fallbackModels: ['claude-sonnet-4-5', 'claude-opus-4-1', 'claude-3-5-haiku-latest'],
  },
  {
    id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1',
    docsUrl: 'https://openrouter.ai/keys', auth: 'bearer', transform: 'openai',
    accent: '#b48cff', direct: true,
    extraHeaders: { 'HTTP-Referer': 'https://nexus-swarm.vercel.app', 'X-Title': 'Nexus Swarm' },
    fallbackModels: ['anthropic/claude-sonnet-4.5', 'openai/gpt-4o-mini', 'google/gemini-2.0-flash-001', 'meta-llama/llama-3.3-70b-instruct'],
    note: 'Aggregator — free-tier models available (suffix :free)',
  },
  {
    id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1',
    docsUrl: 'https://console.groq.com/keys', auth: 'bearer', transform: 'openai',
    accent: '#5fd4ff', direct: true,
    fallbackModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'moonshotai/kimi-k2-instruct', 'qwen/qwen3-32b'],
    note: 'Extremely fast. Free tier generous.',
  },
  {
    id: 'nvidia', name: 'NVIDIA NIM', baseUrl: 'https://integrate.api.nvidia.com/v1',
    docsUrl: 'https://build.nvidia.com/', auth: 'bearer', transform: 'openai',
    accent: '#7dff9b', direct: true,
    fallbackModels: ['meta/llama-3.3-70b-instruct', 'deepseek-ai/deepseek-r1', 'qwen/qwen2.5-coder-32b-instruct', 'nvidia/llama-3.1-nemotron-70b-instruct'],
    note: 'Free credits on signup. Huge model catalog.',
  },
  {
    id: 'gemini', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    docsUrl: 'https://aistudio.google.com/apikey', auth: 'bearer', transform: 'openai',
    accent: '#5fd4ff', direct: true,
    fallbackModels: ['gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-2.5-flash'],
    note: 'Free tier available via AI Studio key.',
  },
  {
    id: 'mistral', name: 'Mistral', baseUrl: 'https://api.mistral.ai/v1',
    docsUrl: 'https://console.mistral.ai/api-keys', auth: 'bearer', transform: 'openai',
    accent: '#ffb454', direct: true,
    fallbackModels: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
  },
  {
    id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1',
    docsUrl: 'https://platform.deepseek.com/api_keys', auth: 'bearer', transform: 'openai',
    accent: '#5fd4ff', direct: true,
    fallbackModels: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    id: 'xai', name: 'xAI Grok', baseUrl: 'https://api.x.ai/v1',
    docsUrl: 'https://console.x.ai/', auth: 'bearer', transform: 'openai',
    accent: '#d7dee6', direct: true,
    fallbackModels: ['grok-3', 'grok-3-mini', 'grok-4'],
  },
  {
    id: 'together', name: 'Together AI', baseUrl: 'https://api.together.xyz/v1',
    docsUrl: 'https://api.together.xyz/settings/api-keys', auth: 'bearer', transform: 'openai',
    accent: '#b48cff', direct: true,
    fallbackModels: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'Qwen/Qwen2.5-Coder-32B-Instruct'],
  },
  {
    id: 'cerebras', name: 'Cerebras', baseUrl: 'https://api.cerebras.ai/v1',
    docsUrl: 'https://cloud.cerebras.ai/', auth: 'bearer', transform: 'openai',
    accent: '#7dff9b', direct: true,
    fallbackModels: ['llama-3.3-70b', 'llama3.1-8b', 'qwen-3-32b'],
    note: 'Fastest inference on the market.',
  },
  {
    id: 'fireworks', name: 'Fireworks', baseUrl: 'https://api.fireworks.ai/inference/v1',
    docsUrl: 'https://fireworks.ai/account/api-keys', auth: 'bearer', transform: 'openai',
    accent: '#ff5c5c', direct: true,
    fallbackModels: ['accounts/fireworks/models/llama-v3p3-70b-instruct', 'accounts/fireworks/models/deepseek-r1'],
  },
  {
    id: 'perplexity', name: 'Perplexity', baseUrl: 'https://api.perplexity.ai',
    docsUrl: 'https://www.perplexity.ai/settings/api', auth: 'bearer', transform: 'openai',
    accent: '#5fd4ff', direct: true,
    fallbackModels: ['sonar', 'sonar-pro', 'sonar-reasoning'],
    note: 'Built-in web search grounding.',
  },
  {
    id: 'ollama', name: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1',
    docsUrl: 'https://ollama.com/download', auth: 'none', transform: 'openai',
    accent: '#8b96a3', direct: true, keyless: true,
    fallbackModels: ['llama3.2', 'qwen2.5-coder', 'deepseek-r1'],
    note: 'Runs on your machine. Set OLLAMA_ORIGINS=* for browser access.',
  },
  {
    id: 'lmstudio', name: 'LM Studio (local)', baseUrl: 'http://localhost:1234/v1',
    docsUrl: 'https://lmstudio.ai/', auth: 'none', transform: 'openai',
    accent: '#8b96a3', direct: true, keyless: true,
    fallbackModels: ['local-model'],
  },
  {
    id: 'custom', name: 'Custom (OpenAI-compatible)', baseUrl: '',
    docsUrl: '', auth: 'bearer', transform: 'openai',
    accent: '#5fd4ff', direct: true,
    note: 'Any OpenAI-compatible endpoint. Set base URL manually.',
  },
];

export function getProvider(id: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
