import { NextRequest, NextResponse } from 'next/server';
import { getProvider } from '@/lib/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const providerId = req.nextUrl.searchParams.get('provider') || '';
  const apiKey = req.headers.get('x-api-key') || req.nextUrl.searchParams.get('key') || '';
  const provider = getProvider(providerId);
  if (!provider) return NextResponse.json({ error: 'unknown provider' }, { status: 400 });

  const base = (provider.baseUrl || '').replace(/\/+$/, '');
  if (!base) return NextResponse.json({ error: 'no base url' }, { status: 400 });

  const headers: Record<string, string> = {};
  if (provider.auth === 'bearer' && apiKey) headers['authorization'] = `Bearer ${apiKey}`;
  if (provider.auth === 'x-api-key' && apiKey) headers['x-api-key'] = apiKey;
  if (provider.transform === 'anthropic') headers['anthropic-version'] = '2023-06-01';
  Object.assign(headers, provider.extraHeaders ?? {});
  delete headers['anthropic-dangerous-direct-browser-access'];

  try {
    const r = await fetch(`${base}/models`, { headers, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    const arr = j?.data ?? j?.models ?? j ?? [];
    const ids = (Array.isArray(arr) ? arr : [])
      .map((m: any) => m?.id ?? m?.name ?? m?.model)
      .filter((x: unknown): x is string => typeof x === 'string');
    const models = Array.from(new Set(ids)).sort();
    return NextResponse.json({ models: models.length ? models : (provider.fallbackModels ?? []) });
  } catch {
    return NextResponse.json({ models: provider.fallbackModels ?? [] });
  }
}
