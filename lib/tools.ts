'use client';

import { vfs } from './vfs';
import type { RunConfig, ToolDef } from './types';

export const TOOL_DEFS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'http_request',
      description:
        'Send a raw HTTP request to any URL and return status, headers, and body. Use for reconnaissance, hitting APIs, testing endpoints, checking headers, probing paths. Runs server-side so CORS does not apply.',
      parameters: {
        type: 'object',
        properties: {
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] },
          url: { type: 'string', description: 'Full URL including scheme.' },
          headers: { type: 'object', description: 'Header name → value.', additionalProperties: { type: 'string' } },
          body: { type: 'string', description: 'Request body as a string.' },
        },
        required: ['method', 'url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web. Returns titles, URLs, and snippets. Use to find current information.',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string' }, limit: { type: 'number', description: 'Max results, default 8.' } },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fetch_url',
      description: 'Fetch a URL and return its readable text (HTML tags stripped). Use for reading pages, docs, articles.',
      parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fs_write',
      description: 'Write a file into the shared virtual workspace. Creates directories implicitly.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string' }, content: { type: 'string' } },
        required: ['path', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fs_read',
      description: 'Read a file from the shared virtual workspace.',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fs_list',
      description: 'List files under a directory in the shared workspace.',
      parameters: { type: 'object', properties: { dir: { type: 'string' } }, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fs_delete',
      description: 'Delete a file or directory recursively.',
      parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'shell',
      description:
        'Run a command against the shared virtual filesystem. Supported: ls, cat, echo "text" > file, mkdir, rm, mv, pwd, tree, wc, grep, head, tail, date, whoami. Not a real OS — it operates on the workspace.',
      parameters: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'js_eval',
      description: 'Evaluate JavaScript in a sandboxed worker. No DOM, no network from inside the sandbox. Returns the value of the last expression. 5s timeout.',
      parameters: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'report',
      description: 'Finish your turn and publish a finding to the shared blackboard. Every turn must end with this.',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'What you found or produced. Concrete.' },
          status: { type: 'string', enum: ['progress', 'done', 'blocked'] },
          artifacts: { type: 'array', items: { type: 'string' }, description: 'File paths you created or key URLs.' },
        },
        required: ['summary', 'status'],
      },
    },
  },
];

export const DIRECTOR_TOOL: ToolDef = {
  type: 'function',
  function: {
    name: 'finish',
    description: 'Declare the mission complete and publish the final deliverable.',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Final answer / deliverable.' },
        artifacts: { type: 'array', items: { type: 'string' } },
      },
      required: ['summary'],
    },
  },
};

const MAX_RESULT = 8000;

function clip(s: string, n = MAX_RESULT) {
  return s.length > n ? s.slice(0, n) + `\n...[truncated ${s.length - n} chars]` : s;
}

/* ---------- sandboxed JS ---------- */

function sandboxEval(code: string): Promise<string> {
  return new Promise((resolve) => {
    const src = `
      self.onmessage = async (e) => {
        const logs = [];
        const _log = (...a) => logs.push(a.map(x => { try { return typeof x === 'string' ? x : JSON.stringify(x); } catch { return String(x); } }).join(' '));
        try {
          const fn = new Function('console', '"use strict"; return (async () => { ' + e.data + ' })();');
          const result = await fn({ log: _log, error: _log, warn: _log });
          self.postMessage({ ok: true, logs, result: result === undefined ? 'undefined' : (typeof result === 'string' ? result : JSON.stringify(result, null, 2)) });
        } catch (err) {
          self.postMessage({ ok: false, logs, error: String(err && err.stack || err) });
        }
      };
    `;
    const blob = new Blob([src], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const w = new Worker(url);
    const timer = setTimeout(() => {
      w.terminate();
      URL.revokeObjectURL(url);
      resolve('ERROR: js_eval timed out after 5000ms');
    }, 5000);
    w.onmessage = (ev) => {
      clearTimeout(timer);
      w.terminate();
      URL.revokeObjectURL(url);
      const d = ev.data;
      const out = [
        d.logs?.length ? `// console\n${d.logs.join('\n')}` : '',
        d.ok ? `// return\n${d.result}` : `// error\n${d.error}`,
      ].filter(Boolean).join('\n\n');
      resolve(clip(out));
    };
    w.onerror = (err) => {
      clearTimeout(timer);
      w.terminate();
      URL.revokeObjectURL(url);
      resolve(`ERROR: ${err.message}`);
    };
    w.postMessage(code);
  });
}

/* ---------- mini shell ---------- */

async function runShell(command: string): Promise<string> {
  const cmd = command.trim();
  const out: string[] = [];

  // redirect: echo "..." > path
  const redir = cmd.match(/^echo\s+(?:"([^"]*)"|'([^']*)'|(\S+))\s*>\s*(\S+)$/);
  if (redir) {
    const content = redir[1] ?? redir[2] ?? redir[3] ?? '';
    await vfs.write(redir[4], content);
    return `wrote ${redir[4]}`;
  }

  const [name, ...args] = cmd.split(/\s+/);
  switch (name) {
    case 'pwd': return '/';
    case 'whoami': return 'swarm';
    case 'date': return new Date().toISOString();
    case 'ls': {
      const files = await vfs.list(args[0] ?? '/');
      return files.length ? files.map((f) => `${f.path}  ${f.content.length}b`).join('\n') : '(empty)';
    }
    case 'tree': {
      const all = await vfs.list('/');
      return all.length ? all.map((f) => `├─ ${f.path}  ${f.content.length}b`).join('\n') : '(empty)';
    }
    case 'cat': {
      if (!args[0]) return 'usage: cat <path>';
      const c = await vfs.read(args[0]);
      return c === null ? `cat: ${args[0]}: no such file` : clip(c, 4000);
    }
    case 'mkdir': return args[0] ? `created ${vfs.normalize(args[0])}` : 'usage: mkdir <dir>';
    case 'rm': {
      if (!args[0]) return 'usage: rm <path>';
      const n = await vfs.remove(args[0]);
      return `removed ${n} file(s)`;
    }
    case 'mv': {
      if (args.length < 2) return 'usage: mv <from> <to>';
      await vfs.move(args[0], args[1]);
      return `moved ${args[0]} → ${args[1]}`;
    }
    case 'wc': {
      const files = await vfs.list('/');
      return `${files.length} files, ${files.reduce((a, f) => a + f.content.length, 0)} bytes`;
    }
    case 'grep': {
      const [pattern, dir] = args;
      if (!pattern) return 'usage: grep <pattern> [dir]';
      const files = await vfs.list(dir ?? '/');
      const hits: string[] = [];
      for (const f of files) {
        f.content.split('\n').forEach((line, i) => {
          if (line.includes(pattern)) hits.push(`${f.path}:${i + 1}: ${line.slice(0, 200)}`);
        });
      }
      return hits.length ? clip(hits.slice(0, 80).join('\n')) : '(no matches)';
    }
    case 'head':
    case 'tail': {
      const [path, nRaw] = args;
      if (!path) return `usage: ${name} <path> [n]`;
      const c = await vfs.read(path);
      if (c === null) return `${name}: ${path}: no such file`;
      const n = parseInt(nRaw || '20', 10);
      const lines = c.split('\n');
      return clip((name === 'head' ? lines.slice(0, n) : lines.slice(-n)).join('\n'));
    }
    default:
      return `shell: ${name}: unknown command. supported: ls, cat, echo >, mkdir, rm, mv, pwd, tree, wc, grep, head, tail, date, whoami`;
  }
}

/* ---------- executor ---------- */

export interface ToolCtx {
  config: RunConfig;
  onFileChange?: () => void;
}

export async function executeTool(name: string, args: Record<string, any>, ctx: ToolCtx): Promise<string> {
  try {
    switch (name) {
      case 'http_request': {
        const r = await fetch('/api/http', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            method: args.method || 'GET',
            url: args.url,
            headers: args.headers || {},
            body: args.body,
          }),
        });
        const j = await r.json();
        if (!r.ok) return `ERROR: ${j?.error || r.status}`;
        const hdrs = Object.entries(j.headers || {}).slice(0, 25).map(([k, v]) => `${k}: ${v}`).join('\n');
        return clip(`STATUS ${j.status}\n${hdrs}\n\n${j.body ?? ''}`);
      }

      case 'web_search': {
        const q = encodeURIComponent(args.query || '');
        const limit = Math.min(Number(args.limit) || 8, 15);
        const params = new URLSearchParams({
          q: args.query || '', limit: String(limit),
          provider: ctx.config.searchProvider, key: ctx.config.searchKey || '',
        });
        const r = await fetch(`/api/search?${params}`);
        const j = await r.json();
        if (!r.ok) return `ERROR: ${j?.error || r.status}`;
        if (!j.results?.length) return '(no results)';
        return clip(j.results.map((x: any, i: number) =>
          `${i + 1}. ${x.title}\n   ${x.url}\n   ${(x.snippet || '').replace(/\s+/g, ' ').slice(0, 260)}`
        ).join('\n\n'));
      }

      case 'fetch_url': {
        const r = await fetch('/api/fetch-url?url=' + encodeURIComponent(args.url));
        const j = await r.json();
        if (!r.ok) return `ERROR: ${j?.error || r.status}`;
        return clip(`# ${j.title || args.url}\n${j.url}\n\n${j.text}`);
      }

      case 'fs_write': {
        const p = await vfs.write(args.path, args.content ?? '');
        ctx.onFileChange?.();
        return `wrote ${p} (${(args.content ?? '').length} bytes)`;
      }
      case 'fs_read': {
        const c = await vfs.read(args.path);
        return c === null ? `ERROR: no such file: ${args.path}` : clip(c);
      }
      case 'fs_list': {
        const files = await vfs.list(args.dir ?? '/');
        return files.length ? files.map((f) => `${f.path}  ${f.content.length}b`).join('\n') : '(empty)';
      }
      case 'fs_delete': {
        const n = await vfs.remove(args.path);
        ctx.onFileChange?.();
        return `removed ${n} file(s)`;
      }
      case 'shell': {
        const r = await runShell(args.command || '');
        ctx.onFileChange?.();
        return clip(r);
      }
      case 'js_eval': {
        return await sandboxEval(args.code || '');
      }
      case 'report': {
        return 'ACK';
      }
      default:
        return `ERROR: unknown tool ${name}`;
    }
  } catch (e) {
    return `ERROR: ${(e as Error).message}`;
  }
}
