'use client';

import { useState } from 'react';
import { RefreshCw, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { PROVIDERS } from '@/lib/providers';
import { listModels } from '@/lib/llm';
import { useStore } from '@/lib/store';

export default function KeyVault() {
  const { keys, setKey } = useStore();

  return (
    <div className="p-3 space-y-2.5">
      <div className="text-[10px] uppercase tracking-widest text-mute px-1">
        Provider keys — stored only in this browser
      </div>
      {PROVIDERS.map((p) => <ProviderCard key={p.id} providerId={p.id} />)}
      {Object.keys(keys).length === 0 && null}
    </div>
  );
}

function ProviderCard({ providerId }: { providerId: string }) {
  const provider = PROVIDERS.find((p) => p.id === providerId)!;
  const { keys, setKey } = useStore();
  const k = keys[providerId] ?? { providerId, apiKey: '', models: [], status: 'idle' as const };

  const [reveal, setReveal] = useState(false);
  const [customBase, setCustomBase] = useState(k.baseUrl ?? '');
  const [open, setOpen] = useState(false);

  const load = async () => {
    setKey(providerId, { status: 'loading', error: undefined });
    try {
      const models = await listModels(providerId, k.apiKey, providerId === 'custom' ? customBase : k.baseUrl);
      setKey(providerId, {
        models,
        status: 'ok',
        error: models.length ? undefined : 'no models returned',
        lastChecked: Date.now(),
        selectedModel: k.selectedModel || models[0],
        baseUrl: providerId === 'custom' ? customBase : undefined,
      });
    } catch (e) {
      setKey(providerId, { status: 'error', error: (e as Error).message });
    }
  };

  const statusIcon = k.status === 'loading'
    ? <RefreshCw size={11} className="animate-spin text-cyan" />
    : k.status === 'ok'
      ? <Check size={11} className="text-acid" />
      : k.status === 'error'
        ? <AlertCircle size={11} className="text-red" />
        : null;

  const configured = !!k.selectedModel;

  return (
    <div className={`border rounded transition ${configured ? 'border-acid/30 bg-acid/[0.03]' : 'border-edge bg-void/40'}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/[0.015] transition"
      >
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: provider.accent }} />
        <span className="text-[12px] font-medium flex-1">{provider.name}</span>
        {statusIcon}
        {configured && <span className="text-[9px] font-mono text-acid/70 truncate max-w-[110px]">{k.selectedModel}</span>}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-edge pt-2.5">
          {(provider.note) && <div className="text-[10px] text-mute leading-relaxed">{provider.note}</div>}

          {providerId === 'custom' && (
            <input
              value={customBase}
              onChange={(e) => setCustomBase(e.target.value)}
              placeholder="https://your-endpoint/v1"
              className="w-full bg-void border border-edge rounded px-2 py-1.5 text-[11px] font-mono focus:border-acid/50 outline-none"
            />
          )}

          {!provider.keyless ? (
            <div className="relative">
              <input
                type={reveal ? 'text' : 'password'}
                value={k.apiKey}
                onChange={(e) => setKey(providerId, { apiKey: e.target.value })}
                placeholder="paste API key"
                className="w-full bg-void border border-edge rounded px-2 py-1.5 pr-8 text-[11px] font-mono focus:border-acid/50 outline-none"
              />
              <button
                onClick={() => setReveal(!reveal)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-mute hover:text-dim"
              >
                {reveal ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            </div>
          ) : (
            <div className="text-[10px] text-mute font-mono">no key required</div>
          )}

          <div className="flex gap-2">
            <button
              onClick={load}
              disabled={k.status === 'loading'}
              className="flex-1 py-1.5 rounded border border-edge2 text-dim text-[11px] hover:border-acid/40 hover:text-acid transition disabled:opacity-40"
            >
              {k.status === 'loading' ? 'fetching…' : 'Fetch models'}
            </button>
            {provider.docsUrl && (
              <a
                href={provider.docsUrl} target="_blank" rel="noreferrer"
                className="px-2.5 py-1.5 rounded border border-edge2 text-mute text-[11px] hover:text-dim transition"
              >
                keys ↗
              </a>
            )}
          </div>

          {k.error && <div className="text-[10px] text-red font-mono break-all">{k.error}</div>}

          {k.models.length > 0 && (
            <select
              value={k.selectedModel ?? ''}
              onChange={(e) => setKey(providerId, { selectedModel: e.target.value })}
              className="w-full bg-void border border-edge rounded px-2 py-1.5 text-[11px] font-mono focus:border-acid/50 outline-none"
            >
              <option value="">— pick a model —</option>
              {k.models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}

          {k.selectedModel && (
            <label className="flex items-center gap-2 text-[10px] text-mute">
              <input
                type="checkbox"
                checked={!!k.useProxy}
                onChange={(e) => setKey(providerId, { useProxy: e.target.checked })}
                className="accent-acid"
              />
              route through server proxy (use if direct calls fail)
            </label>
          )}
        </div>
      )}
    </div>
  );
}
