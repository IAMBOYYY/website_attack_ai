import { NextRequest, NextResponse } from 'next/server';
import { getProvider } from '@/lib/providers';
import {
  buildAnthropicBody, buildOpenAIBody,
  parseAnthropicResponse, parseOpenAIResponse,
} from '@/lib/adapters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }

  const { providerId, apiKey, baseUrl, model, messages, tools, temperature, maxTokens } = body;
  const provider = getProvider(providerId);
  if (!provider) return NextResponse.json({ error: `unknown provider ${providerId}` }, { status: 400 });

  const base = (baseUrl || provider.baseUrl || '').replace(/\/+$/, '');
  if (!base) return NextResponse.json({ error: 'no base url' }, { status: 400 });

  const isAnthropic = provider.transform === 'anthropic';
  const url = isAnthropic ? `${base}/messages` : `${base}/chat/completions`;

  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (provider.auth === 'bearer' && apiKey) headers['authorization'] = `Bearer ${apiKey}`;
  if (provider.auth === 'x-api-key' && apiKey) headers['x-api-key'] = apiKey;
  if (isAnthropic) headers['anthropic-version'] = '2023-06-01';
  Object.assign(headers, provider.extraHeaders ?? {});
  // server-side, no need for the dangerous-direct header
  delete headers['anthropic-dangerous-direct-browser-access'];

  const payload = isAnthropic
    ? buildAnthropicBody({ model, messages, tools, temperature, maxTokens: maxTokens ?? 4096 })
    : buildOpenAIBody({ model, messages, tools, temperature, maxTokens });

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(55_000),
    });
    const text = await res.text();
    let json: any;
    try { json = JSON.parse(text); } catch {
      return NextResponse.json({ error: `upstream non-JSON (${res.status}): ${text.slice(0, 300)}` }, { status: 502 });
    }
    if (!res.ok) {
      return NextResponse.json({ error: json?.error?.message || json?.message || `upstream ${res.status}` }, { status: res.status });
    }
    return NextResponse.json(isAnthropic ? parseAnthropicResponse(json) : parseOpenAIResponse(json));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
