'use client';

import { useStore } from '@/lib/store';
import KeyVault from './KeyVault';
import MissionPanel from './MissionPanel';

const TABS = [
  { id: 'keys', label: 'Keys' },
  { id: 'agents', label: 'Agents' },
  { id: 'targets', label: 'Targets' },
  { id: 'config', label: 'Config' },
] as const;

export default function Sidebar() {
  const { sidebarTab, setSidebarTab } = useStore();

  return (
    <aside className="w-[360px] border-r border-edge bg-panel flex flex-col min-h-0 shrink-0">
      <div className="flex border-b border-edge">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSidebarTab(t.id)}
            className={`flex-1 px-2 py-2.5 text-[11px] uppercase tracking-widest transition ${
              sidebarTab === t.id ? 'text-acid border-b-2 border-acid' : 'text-mute hover:text-dim'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {sidebarTab === 'keys' && <KeyVault />}
        {sidebarTab === 'agents' && <AgentsPanel />}
        {sidebarTab === 'targets' && <TargetsPanel />}
        {sidebarTab === 'config' && <ConfigPanel />}
      </div>
    </aside>
  );
}

/* ---------- Agents ---------- */

import { useState } from 'react';
import { Plus, Trash2, Crown } from 'lucide-react';
import type { AgentRole } from '@/lib/types';

const ROLES: AgentRole[] = ['director', 'scout', 'builder', 'critic', 'executor'];

function AgentsPanel() {
  const { agents, keys, addAgent, removeAgent, updateAgent, setDirector } = useStore();

  const available = Object.values(keys).filter((k) => k.selectedModel);
  const [providerId, setProviderId] = useState('');

  const add = () => {
    const pid = providerId || available[0]?.providerId;
    const k = keys[pid];
    if (!k?.selectedModel) return;
    addAgent({
      name: `${pid}-${Math.random().toString(36).slice(2, 5)}`,
      providerId: pid,
      model: k.selectedModel,
      role: 'executor',
      isDirector: false,
      enabled: true,
      temperature: 0.5,
    });
  };

  return (
    <div className="p-3 space-y-3">
      <div className="text-[10px] uppercase tracking-widest text-mute">Configured agents</div>

      {agents.length === 0 && (
        <div className="text-[12px] text-mute border border-dashed border-edge2 rounded p-3 leading-relaxed">
          No agents yet. Add an API key, fetch models, pick one, then come back here.
        </div>
      )}

      {agents.map((a) => (
        <div key={a.id} className="border border-edge rounded bg-void/50 p-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={a.name}
              onChange={(e) => updateAgent(a.id, { name: e.target.value })}
              className="flex-1 bg-transparent border border-edge rounded px-2 py-1 text-[12px] font-mono focus:border-acid/50 outline-none"
            />
            <button
              onClick={() => setDirector(a.id)}
              title="Set as director"
              className={`p-1.5 rounded border transition ${a.isDirector ? 'border-amber/50 text-amber bg-amber/10' : 'border-edge text-mute hover:text-amber'}`}
            >
              <Crown size={12} />
            </button>
            <button
              onClick={() => removeAgent(a.id)}
              className="p-1.5 rounded border border-edge text-mute hover:text-red hover:border-red/40 transition"
            >
              <Trash2 size={12} />
            </button>
          </div>
          <div className="text-[10px] font-mono text-mute truncate">{a.providerId} / {a.model}</div>
          <div className="flex gap-2">
            <select
              value={a.role}
              onChange={(e) => updateAgent(a.id, { role: e.target.value as AgentRole })}
              className="flex-1 bg-void border border-edge rounded px-2 py-1 text-[11px] focus:border-acid/50 outline-none"
            >
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-[11px] text-mute">
              <input
                type="checkbox"
                checked={a.enabled}
                onChange={(e) => updateAgent(a.id, { enabled: e.target.checked })}
                className="accent-acid"
              />
              on
            </label>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-mute font-mono w-8">T={a.temperature.toFixed(1)}</span>
            <input
              type="range" min="0" max="1.2" step="0.1"
              value={a.temperature}
              onChange={(e) => updateAgent(a.id, { temperature: parseFloat(e.target.value) })}
              className="flex-1 accent-acid"
            />
          </div>
        </div>
      ))}

      <div className="border border-edge rounded p-2.5 space-y-2">
        <div className="text-[10px] uppercase tracking-widest text-mute">Add agent</div>
        <select
          value={providerId}
          onChange={(e) => setProviderId(e.target.value)}
          className="w-full bg-void border border-edge rounded px-2 py-1.5 text-[12px] focus:border-acid/50 outline-none"
        >
          <option value="">— pick a provider with a model —</option>
          {available.map((k) => (
            <option key={k.providerId} value={k.providerId}>
              {k.providerId} · {k.selectedModel}
            </option>
          ))}
        </select>
        <button
          onClick={add}
          disabled={!available.length}
          className="w-full flex items-center justify-center gap-2 py-1.5 rounded border border-acid/40 bg-acid/10 text-acid text-[12px] hover:bg-acid/20 disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <Plus size={12} /> Add agent
        </button>
      </div>
    </div>
  );
}

/* ---------- Targets ---------- */

import { X } from 'lucide-react';

function TargetsPanel() {
  const { targets, addTarget, removeTarget } = useStore();
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');

  const submit = () => {
    const u = url.trim();
    if (!u) return;
    const norm = /^https?:\/\//.test(u) ? u : `https://${u}`;
    addTarget(norm, note.trim() || undefined);
    setUrl(''); setNote('');
  };

  return (
    <div className="p-3 space-y-3">
      <div className="text-[10px] uppercase tracking-widest text-mute">Target URLs</div>

      <div className="space-y-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="https://example.com"
          className="w-full bg-void border border-edge rounded px-2.5 py-2 text-[12px] font-mono focus:border-acid/50 outline-none"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="note (optional) — e.g. 'login page', 'api root'"
          className="w-full bg-void border border-edge rounded px-2.5 py-2 text-[12px] focus:border-acid/50 outline-none"
        />
        <button
          onClick={submit}
          className="w-full py-1.5 rounded border border-acid/40 bg-acid/10 text-acid text-[12px] hover:bg-acid/20 transition"
        >
          Add target
        </button>
      </div>

      {targets.length === 0 ? (
        <div className="text-[12px] text-mute border border-dashed border-edge2 rounded p-3">
          No targets. Agents can still work from the mission alone, or add URLs to scope them.
        </div>
      ) : (
        <div className="space-y-1.5">
          {targets.map((t) => (
            <div key={t.id} className="flex items-start gap-2 border border-edge rounded bg-void/50 p-2">
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-mono text-cyan truncate">{t.url}</div>
                {t.note && <div className="text-[10px] text-mute mt-0.5">{t.note}</div>}
              </div>
              <button onClick={() => removeTarget(t.id)} className="text-mute hover:text-red transition shrink-0">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Config ---------- */

function ConfigPanel() {
  const { config, setConfig } = useStore();
  return (
    <div className="p-3 space-y-4">
      <div className="text-[10px] uppercase tracking-widest text-mute">Run configuration</div>

      <Num label="Max rounds" hint="How many full swarm passes before stopping." value={config.maxRounds} min={1} max={50} onChange={(v) => setConfig({ maxRounds: v })} />
      <Num label="Max total tool calls" hint="Global budget across all agents." value={config.maxToolCalls} min={10} max={2000} onChange={(v) => setConfig({ maxToolCalls: v })} />
      <Num label="Tool calls per agent turn" hint="Loop cap inside a single agent's turn." value={config.maxToolCallsPerTurn} min={1} max={20} onChange={(v) => setConfig({ maxToolCallsPerTurn: v })} />

      <label className="flex items-start gap-2 text-[12px] text-dim">
        <input
          type="checkbox"
          checked={config.goalCheckEveryRound}
          onChange={(e) => setConfig({ goalCheckEveryRound: e.target.checked })}
          className="accent-acid mt-0.5"
        />
        <span>
          Director evaluates after every round
          <span className="block text-[10px] text-mute mt-0.5">Off = director only judges at the end. Saves tokens.</span>
        </span>
      </label>

      <div className="h-px bg-edge" />

      <div className="text-[10px] uppercase tracking-widest text-mute">Web search</div>
      <select
        value={config.searchProvider}
        onChange={(e) => setConfig({ searchProvider: e.target.value as any })}
        className="w-full bg-void border border-edge rounded px-2 py-1.5 text-[12px] focus:border-acid/50 outline-none"
      >
        <option value="duckduckgo">DuckDuckGo (no key)</option>
        <option value="serper">Serper.dev</option>
        <option value="brave">Brave Search</option>
        <option value="tavily">Tavily</option>
      </select>
      {config.searchProvider !== 'duckduckgo' && (
        <input
          value={config.searchKey}
          onChange={(e) => setConfig({ searchKey: e.target.value })}
          placeholder="search API key"
          type="password"
          className="w-full bg-void border border-edge rounded px-2 py-1.5 text-[12px] font-mono focus:border-acid/50 outline-none"
        />
      )}
    </div>
  );
}

function Num({ label, hint, value, min, max, onChange }: {
  label: string; hint: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline">
        <span className="text-[12px] text-dim">{label}</span>
        <span className="text-[11px] font-mono text-acid">{value}</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full accent-acid mt-1"
      />
      <div className="text-[10px] text-mute mt-0.5">{hint}</div>
    </div>
  );
}
