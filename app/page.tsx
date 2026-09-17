'use client';

import { useCallback, useRef, useState } from 'react';
import TopBar from '@/components/TopBar';
import Sidebar from '@/components/Sidebar';
import Console from '@/components/Console';
import AgentGrid from '@/components/AgentGrid';
import FileExplorer from '@/components/FileExplorer';
import Terminal from '@/components/Terminal';
import { useStore } from '@/lib/store';
import { runSwarm } from '@/lib/orchestrator';

export default function Page() {
  const stopRef = useRef(false);
  const store = useStore();
  const [rightTab, setRightTab] = useState<'agents' | 'files'>('agents');

  const onRun = useCallback(async () => {
    if (store.running) return;
    stopRef.current = false;
    store.clearEvents();
    store.setRunning(true);

    await runSwarm(
      {
        mission: store.mission,
        targets: store.targets,
        agents: store.agents,
        keys: store.keys,
        config: store.config,
      },
      {
        onEvent: (e) => useStore.getState().pushEvent(e),
        onRuntime: (r) => useStore.getState().setRuntime(r),
        onDone: () => useStore.getState().setRunning(false),
        shouldStop: () => stopRef.current,
      }
    );

    useStore.getState().setRunning(false);
  }, [store]);

  const onStop = useCallback(() => {
    stopRef.current = true;
    useStore.getState().setRunning(false);
  }, []);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopBar onRun={onRun} onStop={onStop} />
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <main className="flex-1 min-w-0 flex flex-col">
          <Console />
          {store.showTerminal && <Terminal />}
        </main>
        <aside className="w-[340px] border-l border-edge flex flex-col min-h-0 bg-panel">
          <div className="flex border-b border-edge">
            {(['agents', 'files'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setRightTab(t)}
                className={`flex-1 px-3 py-2 text-[11px] uppercase tracking-widest transition ${
                  rightTab === t ? 'text-acid border-b-2 border-acid' : 'text-mute hover:text-dim'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            {rightTab === 'agents' ? <AgentGrid /> : <FileExplorer />}
          </div>
        </aside>
      </div>
    </div>
  );
}
