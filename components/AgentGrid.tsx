'use client';

import { useStore } from '@/lib/store';
import { Crown } from 'lucide-react';

const DOT: Record<string, string> = {
  idle: 'bg-mute',
  thinking: 'bg-cyan animate-pulse2',
  tool: 'bg-amber animate-pulse2',
  reporting: 'bg-violet animate-pulse2',
  done: 'bg-acid',
  error: 'bg-red',
  offline: 'bg-edge2',
};

export default function AgentGrid() {
  const { agents, runtime, events } = useStore();

  if (!agents.length) {
    return (
      <div className="p-4 text-[12px] text-mute leading-relaxed">
        No agents configured.<br /><br />
        <span className="text-dim">1.</span> Paste an API key in the Keys tab.<br />
        <span className="text-dim">2.</span> Fetch models, pick one.<br />
        <span className="text-dim">3.</span> Add it as an agent in the Agents tab.<br />
        <span className="text-dim">4.</span> Mark one as director (crown).<br />
        <span className="text-dim">5.</span> Launch.
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2 overflow-y-auto h-full">
      {agents.map((a) => {
        const r = runtime[a.id];
        const status = r?.status ?? 'idle';
        const last = [...events].reverse().find((e) => e.agentId === a.id);
        return (
          <div key={a.id} className={`border rounded p-2.5 transition ${a.enabled ? 'border-edge bg-void/40' : 'border-edge2 bg-void/20 opacity-50'}`}>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${DOT[status] ?? 'bg-mute'}`} />
              <span className="text-[12px] font-medium flex-1 truncate">{a.name}</span>
              {a.isDirector && <Crown size={11} className="text-amber" />}
            </div>
            <div className="text-[10px] font-mono text-mute truncate mt-1">{a.model}</div>
            <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-mute">
              <span className="uppercase tracking-wider">{a.role}</span>
              <span>{status}</span>
              {r && <span className="ml-auto">{r.tokensIn + r.tokensOut} tok</span>}
              {r && r.calls > 0 && <span>{r.calls} calls</span>}
              {r && r.errors > 0 && <span className="text-red">{r.errors} err</span>}
            </div>
            {last && (
              <div className="text-[10px] text-dim mt-1.5 line-clamp-2 leading-snug">
                <span className="text-mute font-mono">{last.tool ?? last.kind}:</span> {last.content.slice(0, 120)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
