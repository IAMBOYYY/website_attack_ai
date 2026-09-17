import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Result { title: string; url: string; snippet: string }

async function duckduckgo(q: string, limit: number): Promise<Result[]> {
  const r = await fetch('https://lite.duckduckgo.com/lite/', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    },
    body: new URLSearchParams({ q }).toString(),
    signal: AbortSignal.timeout(15_000),
  });
  const html = await r.text();
  const results: Result[] = [];

  const linkRe = /<a[^>]+class="result-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRe = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;

  const links: { url: string; title: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html))) {
    links.push({
      url: m[1],
      title: m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
    });
  }
  const snippets: string[] = [];
  while ((m = snippetRe.exec(html))) {
    snippets.push(m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
  }

  for (let i = 0; i < links.length && results.length < limit; i++) {
    if (!links[i].url.startsWith('http')) continue;
    results.push({ title: links[i].title, url: links[i].url, snippet: snippets[i] ?? '' });
  }
  return results;
}

async function serper(q: string, limit: number, key: string): Promise<Result[]> {
  const r = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: { 'X-API-KEY': key, 'content-type': 'application/json' },
    body: JSON.stringify({ q, num: limit }),
    signal: AbortSignal.timeout(15_000),
  });
  const j = await r.json();
  return (j.organic ?? []).slice(0, limit).map((x: any) => ({ title: x.title, url: x.link, snippet: x.snippet ?? '' }));
}

async function brave(q: string, limit: number, key: string): Promise<Result[]> {
  const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=${limit}`, {
    headers: { 'X-Subscription-Token': key, 'accept': 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  const j = await r.json();
  return (j.web?.results ?? []).slice(0, limit).map((x: any) => ({ title: x.title, url: x.url, snippet: x.description ?? '' }));
}

async function tavily(q: string, limit: number, key: string): Promise<Result[]> {
  const r = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ api_key: key, query: q, max_results: limit }),
    signal: AbortSignal.timeout(20_000),
  });
  const j = await r.json();
  return (j.results ?? []).slice(0, limit).map((x: any) => ({ title: x.title, url: x.url, snippet: x.content ?? '' }));
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || '';
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '8', 10), 15);
  const provider = req.nextUrl.searchParams.get('provider') || 'duckduckgo';
  const key = req.nextUrl.searchParams.get('key') || '';
  if (!q.trim()) return NextResponse.json({ results: [] });

  try {
    let results: Result[] = [];
    if (provider === 'serper' && key) results = await serper(q, limit, key);
    else if (provider === 'brave' && key) results = await brave(q, limit, key);
    else if (provider === 'tavily' && key) results = await tavily(q, limit, key);
    else results = await duckduckgo(q, limit);
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, results: [] }, { status: 502 });
  }
}
