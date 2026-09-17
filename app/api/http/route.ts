import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }

  const { method = 'GET', url, headers = {}, body: reqBody } = body ?? {};
  if (!url || typeof url !== 'string') return NextResponse.json({ error: 'missing url' }, { status: 400 });

  let parsed: URL;
  try { parsed = new URL(url); } catch { return NextResponse.json({ error: 'invalid url' }, { status: 400 }); }
  if (!/^https?:$/.test(parsed.protocol)) return NextResponse.json({ error: 'only http/https' }, { status: 400 });

  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      method: method.toUpperCase(),
      headers: { 'user-agent': 'NexusSwarm/1.0', ...headers },
      body: ['GET', 'HEAD'].includes(method.toUpperCase()) ? undefined : reqBody,
      redirect: 'follow',
      signal: AbortSignal.timeout(25_000),
    });
    const text = await r.text();
    const outHeaders: Record<string, string> = {};
    r.headers.forEach((v, k) => { outHeaders[k] = v; });
    return NextResponse.json({
      status: r.status,
      statusText: r.statusText,
      headers: outHeaders,
      body: text.slice(0, 60_000),
      elapsedMs: Date.now() - t0,
      finalUrl: r.url,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, elapsedMs: Date.now() - t0 }, { status: 502 });
  }
}
