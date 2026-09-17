'use client';

import { Play, Square, Trash2, TerminalSquare, Github } from 'lucide-react';
import { useStore } from '@/lib/store';

export default function TopBar({ onRun, onStop }: { onRun: () => void; onStop: () => void }) {
  const { running, events, runtime, showTerminal, setShowTerminal, clearEvents, agents, keys } = useStore();

  const toolCalls = events.filter((e) => e.kind === 'tool').length;
  const tokensIn = Object.values(runtime).reduce((a, r) => a + r.tokensIn, 0);
  const tokensOut = Object.values(runtime).reduce((a, r) => a + r.tokensOut, 0);
  const keysLoaded = Object.values(keys).filter((k) => k.apiKey || k.providerId === 'ollama').length;

  return (
    <header className="h-14 border-b border-edge bg-panel flex items-center px-4 gap-4 shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded border border-acid/40 bg-acid/10 grid place-items-center">
          <div className="w-2 h-2 rounded-full bg-acid animate-pulse2" />
        </div>
        <div className="leading-none">
          <div className="text-[13px] font-semibold tracking-wide">NEXUS<span className="text-acid">SWARM</span></div>
          <div className="text-[9px] text-mute uppercase tracking-[0.2em] mt-0.5">multi-agent orchestration</div>
        </div>
      </div>

      <div className="h-6 w-px bg-edge mx-2" />

      <div className="flex items-center gap-4 text-[11px] font-mono text-mute">
        <span>KEYS <span className="text-dim">{keysLoaded}</span></span>
        <span>AGENTS <span className="text-dim">{agents.filter((a) => a.enabled).length}</span></span>
        <span>EVENTS <span className="text-dim">{events.length}</span></span>
        <span>TOOLS <span className="text-dim">{toolCalls}</span></span>
        <span>TOK <span className="text-dim">{(tokensIn + tokensOut).toLocaleString()}</span></span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => setShowTerminal(!showTerminal)}
          className={`p-2 rounded border transition ${showTerminal ? 'border-acid/40 text-acid bg-acid/5' : 'border-edge text-mute hover:text-dim hover:border-edge2'}`}
          title="Toggle terminal"
        >
          <TerminalSquare size={15} />
        </button>
        <button
          onClick={clearEvents}
          className="p-2 rounded border border-edge text-mute hover:text-dim hover:border-edge2 transition"
          title="Clear console"
        >
          <Trash2 size={15} />
        </button>
        {running ? (
          <button
            onClick={onStop}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded border border-red/40 bg-red/10 text-red text-[12px] font-medium hover:bg-red/20 transition"
          >
            <Square size={12} fill="currentColor" /> STOP
          </button>
        ) : (
          <button
            onClick={onRun}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded border border-acid/40 bg-acid/10 text-acid text-[12px] font-medium hover:bg-acid/20 transition"
          >
            <Play size={12} fill="currentColor" /> LAUNCH
          </button>
        )}
      </div>
    </header>
  );
}
