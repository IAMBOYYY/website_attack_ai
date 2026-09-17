'use client';

import { get, set } from 'idb-keyval';
import type { VFile } from './types';

const KEY = 'nexus:vfs';

let cache: Record<string, VFile> | null = null;

async function load(): Promise<Record<string, VFile>> {
  if (cache) return cache;
  cache = (await get(KEY)) ?? {};
  return cache;
}

async function persist() {
  await set(KEY, cache ?? {});
}

function normalize(p: string): string {
  let s = (p || '/').trim().replace(/\\/g, '/');
  if (!s.startsWith('/')) s = '/' + s;
  const parts: string[] = [];
  for (const seg of s.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return '/' + parts.join('/');
}

export const vfs = {
  async write(path: string, content: string) {
    const files = await load();
    const p = normalize(path);
    files[p] = { path: p, content, mtime: Date.now() };
    await persist();
    return p;
  },
  async read(path: string): Promise<string | null> {
    const files = await load();
    return files[normalize(path)]?.content ?? null;
  },
  async list(dir = '/'): Promise<VFile[]> {
    const files = await load();
    const d = normalize(dir);
    const prefix = d === '/' ? '/' : d + '/';
    return Object.values(files)
      .filter((f) => f.path.startsWith(prefix))
      .sort((a, b) => a.path.localeCompare(b.path));
  },
  async remove(path: string): Promise<number> {
    const files = await load();
    const p = normalize(path);
    let n = 0;
    for (const k of Object.keys(files)) {
      if (k === p || k.startsWith(p + '/')) { delete files[k]; n++; }
    }
    await persist();
    return n;
  },
  async move(from: string, to: string) {
    const files = await load();
    const f = normalize(from), t = normalize(to);
    if (!files[f]) throw new Error(`not found: ${f}`);
    files[t] = { ...files[f], path: t, mtime: Date.now() };
    delete files[f];
    await persist();
    return t;
  },
  async tree(): Promise<Record<string, VFile>> {
    return { ...(await load()) };
  },
  async wipe() {
    cache = {};
    await persist();
  },
  normalize,
};
