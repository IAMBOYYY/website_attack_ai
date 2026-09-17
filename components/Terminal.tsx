'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { vfs } from '@/lib/vfs';

const BANNER = [
  'nexus-swarm shell v1.0 — workspace commands only',
  'supported: ls · cat · echo "x" > file · mkdir · rm · mv · pwd · tree · wc · grep · head · tail · date · whoami · clear · help',
];

export default function Terminal() {
  const { events, agents, runtime } = useStore();
  const [lines, setLines] = useState<string[]>(BANNER);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [lines]);

  const push = (...s: string[]) => setLines((l) => [...l, ...s].slice(-500));

  const run = async (raw: string) => {
    const cmd = raw.trim();
    push(`$ ${cmd}`);
    if (!cmd) return;

    const [name, ...args] = cmd.split(/\s+/);

    if (name === 'clear') { setLines([]); return; }
    if (name === 'help') { push(...BANNER.slice(1)); return; }
    if (name === 'agents') {
      push(...agents.map((a) => {
        const r = runtime[a.id];
        return `${a.isDirector ? '★' : ' '} ${a.name.padEnd(18)} ${a.providerId}/${a.model}  [${r?.status ?? 'idle'}] ${r?.tokensIn + r?.tokensOut || 0}tok`;
      }));
      return;
    }
    if (name === 'events') {
      const n = parseInt(args[0] || '15', 10);
      push(...events.slice(-n).map((e) => `r${e.round} ${e.kind.padEnd(11)} ${e.agentName.padEnd(16)} ${e.content.slice(0, 90).replace(/\n/g, ' ')}`));
      return;
    }
    if (name === 'wipe') {
      await vfs.wipe();
      push('workspace wiped');
      return;
    }

    const redir = cmd.match(/^echo\s+(?:"([^"]*)"|'([^']*)'|(\S+))\s*>\s*(\S+)$/);
    if (redir) {
      const content = redir[1] ?? redir[2] ?? redir[3] ?? '';
      await vfs.write(redir[4], content);
      push(`wrote ${redir[4]}`);
      return;
    }

    switch (name) {
      case 'pwd': push('/'); break;
      case 'whoami': push('operator'); break;
      case 'date': push(new Date().toISOString()); break;
      case 'ls': {
        const files = await vfs.list(args[0] ?? '/');
        push(files.length ? files.map((f) => `${f.path.padEnd(40)} ${f.content.length}b`).join('\n') : '(empty)');
        break;
      }
      case 'tree': {
        const files = await vfs.list('/');
        push(files.length ? files.map((f) => `├─ ${f.path}  ${f.content.length}b`).join('\n') : '(empty)');
        break;
      }
      case 'cat': {
        const c = await vfs.read(args[0] ?? '');
        push(c === null ? `cat: ${args[0]}: no such file` : c.slice(0, 5000));
        break;
      }
      case 'mkdir': push(`created ${vfs.normalize(args[0] ?? '/')}`); break;
      case 'rm': push(`removed ${await vfs.remove(args[0] ?? '')} file(s)`); break;
      case 'mv': {
        try { await vfs.move(args[0], args[1]); push(`moved`); }
        catch (e) { push(`mv: ${(e as Error).message}`); }
        break;
      }
      case 'wc': {
        const files = await vfs.list('/');
        push(`${files.length} files, ${files.reduce((a, f) => a + f.content.length, 0)} bytes`);
        break;
      }
      case 'grep': {
        const files = await vfs.list('/');
        const hits: string[] = [];
        for (const f of files) {
          f.content.split('\n').forEach((l, i) => {
            if (l.includes(args[0])) hits.push(`${f.path}:${i + 1}: ${l.slice(0, 160)}`);
          });
        }
        push(hits.length ? hits.slice(0, 60).join('\n') : '(no matches)');
        break;
      }
      case 'head':
      case 'tail': {
        const c = await vfs.read(args[0] ?? '');
        if (c === null) { push(`${name}: no such file`); break; }
        const n = parseInt(args[1] || '20', 10);
        const ls = c.split('\n');
        push((name === 'head' ? ls.slice(0, n) : ls.slice(-n)).join('\n'));
        break;
      }
      default:
        push(`shell: ${name}: command not found. type 'help'.`);
    }
  };

  const onKey = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const v = input;
      setInput('');
      setHistory((h) => [v, ...h].slice(0, 100));
      setHIdx(-1);
      await run(v);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const i = Math.min(hIdx + 1, history.length - 1);
      if (i >= 0) { setHIdx(i); setInput(history[i]); }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const i = hIdx - 1;
      setHIdx(i);
      setInput(i >= 0 ? history[i] : '');
    }
  };

  return (
    <div className="h-56 border-t border-edge bg-black/60 flex flex-col shrink-0 font-mono text-[11.5px]">
      <div className="flex items-center px-3 py-1 border-b border-edge text-[9px] uppercase tracking-widest text-mute">
        terminal
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {lines.map((l, i) => (
          <div key={i} className={`whitespace-pre-wrap break-words ${l.startsWith('$') ? 'text-acid' : 'text-dim'}`}>{l}</div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="flex items-center gap-2 px-3 py-2 border-t border-edge">
        <span className="text-acid">$</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          spellCheck={false}
          autoComplete="off"
          className="flex-1 bg-transparent outline-none text-ink"
          placeholder="ls / grep / cat …"
        />
      </div>
    </div>
  );
}
