'use client';

import { getProvider } from './providers';
import {
  buildAnthropicBody, buildOpenAIBody,
  parseAnthropicResponse, parseOpenAIResponse,
} from './adapters';
import type { ChatMessage, LLMResponse, ToolDef } from './types';

export interface CallOpts {
  providerId: string;
  apiKey: string;
  baseUrl?: string;
  model: string;
  messages: ChatMessage[];
  tools?: ToolDef[];
  temperature?: number;
  maxTokens?: number;
  useProxy?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function callModel(opts: CallOpts): Promise<LLMResponse> {
  const provider = getProvider(opts.providerId);
  if (!provider) throw new Error(`Unknown provider: ${opts.providerId}`);

  const base = (opts.baseUrl || provider.baseUrl || '').replace(/\/+$/, '');
  if (!base) throw new Error(`No base URL for ${provider.name}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 180_000);
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onAbort);

  try {
    if (opts.useProxy) {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          providerId: opts.providerId,
          apiKey: opts.apiKey,
          baseUrl: base,
          model: opts.model,
          messages: opts.messages,
          tools: opts.tools,
          temperature: opts.temperature,
          maxTokens: opts.maxTokens,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `proxy ${r.status}`);
      return j as LLMResponse;
    }

    const isAnthropic = provider.transform === 'anthropic';
    const url = isAnthropic ? `${base}/messages` : `${base}/chat/completions`;

    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (provider.auth === 'bearer' && opts.apiKey) headers['authorization'] = `Bearer ${opts.apiKey}`;
    if (provider.auth === 'x-api-key' && opts.apiKey) headers['x-api-key'] = opts.apiKey;
    if (isAnthropic) headers['anthropic-version'] = '2023-06-01';
    Object.assign(headers, provider.extraHeaders ?? {});

    const body = isAnthropic
      ? buildAnthropicBody({
          model: opts.model, messages: opts.messages, tools: opts.tools,
          temperature: opts.temperature, maxTokens: opts.maxTokens ?? 4096,
        })
      : buildOpenAIBody({
          model: opts.model, messages: opts.messages, tools: opts.tools,
          temperature: opts.temperature, maxTokens: opts.maxTokens,
        });

    const res = await fetch(url, {
      method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal,
    });

    const text = await res.text();
    let json: any;
    try { json = JSON.parse(text); } catch { throw new Error(`non-JSON response (${res.status}): ${text.slice(0, 300)}`); }
    if (!res.ok) {
      const msg = json?.error?.message || json?.message || JSON.stringify(json).slice(0, 300);
      throw new Error(`${provider.name} ${res.status}: ${msg}`);
    }

    return isAnthropic ? parseAnthropicResponse(json) : parseOpenAIResponse(json);
  } finally {
    clearTimeout(timeout);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}

export async function listModels(providerId: string, apiKey: string, baseUrl?: string): Promise<string[]> {
  const provider = getProvider(providerId);
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);
  const base = (baseUrl || provider.baseUrl || '').replace(/\/+$/, '');
  if (!base) throw new Error('No base URL');

  const url = `${base}/models`;
  const headers: Record<string, string> = {};
  if (provider.auth === 'bearer' && apiKey) headers['authorization'] = `Bearer ${apiKey}`;
  if (provider.auth === 'x-api-key' && apiKey) headers['x-api-key'] = apiKey;
  if (providerId === 'anthropic') headers['anthropic-version'] = '2023-06-01';
  Object.assign(headers, provider.extraHeaders ?? {});

  try {
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`${r.status}`);
    const j = await r.json();
    const arr = j?.data ?? j?.models ?? j ?? [];
    const ids: string[] = (Array.isArray(arr) ? arr : [])
      .map((m: any) => m?.id ?? m?.name ?? m?.model)
      .filter((x: unknown): x is string => typeof x === 'string' && x.length > 0);
    const uniq = Array.from(new Set(ids)).sort();
    return uniq.length ? uniq : (provider.fallbackModels ?? []);
  } catch {
    return provider.fallbackModels ?? [];
  }
}
