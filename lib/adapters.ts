import type { ChatMessage, LLMResponse, ToolCall } from './types';

/* ---------- OpenAI shape (default) ---------- */

export function buildOpenAIBody(opts: {
  model: string;
  messages: ChatMessage[];
  tools?: unknown[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}) {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: opts.messages.map((m) => {
      if (m.role === 'tool') {
        return { role: 'tool', content: m.content ?? '', tool_call_id: m.tool_call_id };
      }
      if (m.role === 'assistant' && m.tool_calls?.length) {
        return { role: 'assistant', content: m.content ?? '', tool_calls: m.tool_calls };
      }
      return { role: m.role, content: m.content ?? '' };
    }),
  };
  if (opts.tools?.length) { body.tools = opts.tools; body.tool_choice = 'auto'; }
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (opts.stream) body.stream = true;
  return body;
}

export function parseOpenAIResponse(json: any): LLMResponse {
  const choice = json?.choices?.[0];
  const msg = choice?.message ?? {};
  const tool_calls: ToolCall[] = (msg.tool_calls ?? []).map((tc: any) => ({
    id: tc.id ?? `call_${Math.random().toString(36).slice(2, 10)}`,
    type: 'function',
    function: {
      name: tc.function?.name ?? '',
      arguments: typeof tc.function?.arguments === 'string'
        ? tc.function.arguments
        : JSON.stringify(tc.function?.arguments ?? {}),
    },
  }));
  return {
    content: msg.content ?? '',
    tool_calls,
    usage: json?.usage
      ? { input: json.usage.prompt_tokens ?? 0, output: json.usage.completion_tokens ?? 0 }
      : undefined,
    raw: json,
  };
}

/* ---------- Anthropic shape ---------- */

export function buildAnthropicBody(opts: {
  model: string;
  messages: ChatMessage[];
  tools?: unknown[];
  temperature?: number;
  maxTokens?: number;
}) {
  const systemParts: string[] = [];
  const msgs: any[] = [];

  for (const m of opts.messages) {
    if (m.role === 'system') { systemParts.push(m.content ?? ''); continue; }

    if (m.role === 'user') {
      msgs.push({ role: 'user', content: [{ type: 'text', text: m.content ?? '' }] });
      continue;
    }

    if (m.role === 'assistant') {
      const blocks: any[] = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      for (const tc of m.tool_calls ?? []) {
        let input: unknown = {};
        try { input = JSON.parse(tc.function.arguments || '{}'); } catch { input = { _raw: tc.function.arguments }; }
        blocks.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input });
      }
      if (!blocks.length) blocks.push({ type: 'text', text: '' });
      msgs.push({ role: 'assistant', content: blocks });
      continue;
    }

    if (m.role === 'tool') {
      msgs.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content ?? '' }],
      });
    }
  }

  // Anthropic requires alternating user/assistant. Merge consecutive same-role.
  const merged: any[] = [];
  for (const m of msgs) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content.push(...m.content);
    else merged.push({ ...m, content: [...m.content] });
  }
  if (merged.length && merged[0].role !== 'user') {
    merged.unshift({ role: 'user', content: [{ type: 'text', text: '(start)' }] });
  }

  const body: Record<string, unknown> = {
    model: opts.model,
    max_tokens: opts.maxTokens ?? 4096,
    messages: merged,
  };
  if (systemParts.length) body.system = systemParts.join('\n\n');
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  if (opts.tools?.length) {
    body.tools = (opts.tools as any[]).map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));
  }
  return body;
}

export function parseAnthropicResponse(json: any): LLMResponse {
  const blocks: any[] = json?.content ?? [];
  let text = '';
  const tool_calls: ToolCall[] = [];
  for (const b of blocks) {
    if (b.type === 'text') text += b.text ?? '';
    if (b.type === 'tool_use') {
      tool_calls.push({
        id: b.id ?? `call_${Math.random().toString(36).slice(2, 10)}`,
        type: 'function',
        function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
      });
    }
  }
  return {
    content: text,
    tool_calls,
    usage: json?.usage
      ? { input: json.usage.input_tokens ?? 0, output: json.usage.output_tokens ?? 0 }
      : undefined,
    raw: json,
  };
}
