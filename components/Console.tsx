'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import Markdown from './Markdown';
import type { BBEvent } from '@/lib/types';

const KIND_STYLE: Record<string, { badge: string; cls: string }> = {
  system:      { badge: 'SYS',  cls: 'border-l-edge2 text-dim' },
  plan:        { badge: 'PLAN', cls: 'border-l-violet text-ink bg-violet/[0.03]' },
  text:        { badge: 'SAY',  cls: 'border-l-cyan' },
  tool:        { badge: 'CALL', cls: 'border-l-amber' },
  tool_result: { badge: 'RET',  cls: 'border-l-amber/40 text-dim' },
  report:      { badge: 'RPT',  cls: 'border-l-acid bg-acid/[0.03]' },
  verdict:     { badge: 'JUDGE',cls: 'border-l-violet bg-violet/[0.04]' },
  error:       { badge: 'ERR',  cls: 'border-l-red bg-red/[0.04]' },
  final:       { badge: 'DONE', cls: 'border-l-acid bg-acid/[0.06] glow-acid' },
};

export default function Console() {
  const { events, mission, setMission, running, config } = useStore();
  const scroller = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    if (autoScroll && scroller.current) {
      scroller.current.scrollTop = scroller.current.scrollHeight;
    }
  }, [events.length, autoScroll]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  const shown = useMemo(
    () => (filter ? events.filter((e) => e.kind === filter) : events),
    [events, filter]
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-void grid-bg">
      {!running && events.length === 0 && (
        <div className="p-4 border-b border-edge bg-panel/60">
          <div className="text-[10px] uppercase tracking-widest text-mute mb-2">Mission brief</div>
          <textarea
            value={mission}
            onChange={(e) => setMission(e.target.value)}
            placeholder="e.g. Recon https://target.tld — enumerate endpoints, headers, and any exposed config. Write a full report to /recon/report.md"
            rows={3}
            className="w-full bg-void border border-edge rounded px-3 py-2.5 text-[13px] focus:border-acid/50 outline-none resize-y leading-relaxed"
          />
          <div className="flex gap-3 mt-2 text-[10px] text-mute font-mono">
            <span>rounds ≤ {config.maxRounds}</span>
            <span>tool calls ≤ {config.maxToolCalls}</span>
            <span>per-turn ≤ {config.maxToolCallsPerTurn}</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-edge bg-panel/40 text-[10px] font-mono">
        <button
          onClick={() => setFilter(null)}
          className={`px-2 py-0.5 rounded border transition ${!filter ? 'border-acid/40 text-acid' : 'border-edge text-mute hover:text-dim'}`}
        >
          ALL {events.length}
        </button>
        {Object.entries(KIND_STYLE).map(([kind, s]) => {
          const n = events.filter((e) => e.kind === kind).length;
          if (!n) return null;
          return (
            <button
              key={kind}
              onClick={() => setFilter(filter === kind ? null : kind)}
              className={`px-2 py-0.5 rounded border transition ${filter === kind ? 'border-acid/40 text-acid' : 'border-edge text-mute hover:text-dim'}`}
            >
              {s.badge} {n}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          {!autoScroll && (
            <button
              onClick={() => { setAutoScroll(true); scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }); }}
              className="text-acid hover:underline"
            >
              ↓ jump to live
            </button>
          )}
          {running && <span className="text-acid animate-pulse2">● live</span>}
        </div>
      </div>

      <div ref={scroller} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-1.5">
        {shown.length === 0 && (
          <div className="text-[12px] text-mute text-center mt-12 font-mono">
            {events.length === 0 ? 'awaiting launch…' : 'no events match this filter'}
          </div>
        )}
        {shown.map((e) => <EventRow key={e.id} e={e} />)}
        {running && <div className="caret text-acid text-[12px] font-mono pl-1" />}
      </div>
    </div>
  );
}

function EventRow({ e }: { e: BBEvent }) {
  const s = KIND_STYLE[e.kind] ?? KIND_STYLE.text;
  const [open, setOpen] = useState(e.kind === 'final' || e.kind === 'plan' || e.kind === 'verdict');

  const isLong = e.content.length > 700;
  const body = open || !isLong ? e.content : e.content.slice(0, 700) + '…';

  return (
    <div className={`border-l-2 pl-3 py-2 ${s.cls}`}>
      <div className="flex items-center gap-2 text-[10px] font-mono text-mute mb-1">
        <span className="px-1.5 py-0.5 rounded bg-white/[0.04] text-dim">{s.badge}</span>
        {e.round > 0 && <span>r{e.round}</span>}
        {e.agentName && e.agentName !== 'SWARM' && <span className="text-dim">{e.agentName}</span>}
        {e.tool && <span className="text-amber">{e.tool}</span>}
        {e.model && <span className="truncate max-w-[180px] opacity-60">{e.model}</span>}
        <span className="ml-auto opacity-40">{new Date(e.ts).toLocaleTimeString()}</span>
      </div>

      {e.kind === 'tool' || e.kind === 'tool_result' ? (
        <pre className="text-[11px] font-mono whitespace-pre-wrap break-words text-dim bg-black/30 border border-edge rounded p-2 max-h-[420px] overflow-auto">
          {body}
        </pre>
      ) : (
        <div className="text-[12.5px] leading-relaxed">
          <Markdown>{body}</Markdown>
        </div>
      )}

      {isLong && (
        <button onClick={() => setOpen(!open)} className="text-[10px] text-acid hover:underline mt-1 font-mono">
          {open ? '− collapse' : `+ show ${e.content.length - 700} more`}
        </button>
      )}
    </div>
  );
}
