'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AgentConfig, BBEvent, ProviderKey, RunConfig, Target, AgentRuntime } from './types';

const uid = () => Math.random().toString(36).slice(2, 11);

interface State {
  keys: Record<string, ProviderKey>;
  agents: AgentConfig[];
  targets: Target[];
  mission: string;
  config: RunConfig;
  events: BBEvent[];
  runtime: Record<string, AgentRuntime>;
  running: boolean;
  showTerminal: boolean;
  sidebarTab: 'keys' | 'agents' | 'targets' | 'config';
  rightTab: 'agents' | 'files';

  setKey: (providerId: string, patch: Partial<ProviderKey>) => void;
  addAgent: (a: Omit<AgentConfig, 'id'>) => void;
  updateAgent: (id: string, patch: Partial<AgentConfig>) => void;
  removeAgent: (id: string) => void;
  setDirector: (id: string) => void;

  addTarget: (url: string, note?: string) => void;
  removeTarget: (id: string) => void;

  setMission: (m: string) => void;
  setConfig: (patch: Partial<RunConfig>) => void;

  pushEvent: (e: BBEvent) => void;
  clearEvents: () => void;
  setRuntime: (r: Record<string, AgentRuntime>) => void;
  setRunning: (r: boolean) => void;
  setShowTerminal: (v: boolean) => void;
  setSidebarTab: (t: State['sidebarTab']) => void;
  setRightTab: (t: State['rightTab']) => void;
}

export const useStore = create<State>()(
  persist(
    (set) => ({
      keys: {},
      agents: [],
      targets: [],
      mission: '',
      config: {
        maxRounds: 6,
        maxToolCalls: 200,
        maxToolCallsPerTurn: 6,
        searchProvider: 'duckduckgo',
        searchKey: '',
        goalCheckEveryRound: true,
      },
      events: [],
      runtime: {},
      running: false,
      showTerminal: false,
      sidebarTab: 'keys',
      rightTab: 'agents',

      setKey: (providerId, patch) =>
        set((s) => ({
          keys: {
            ...s.keys,
            [providerId]: {
              apiKey: '',
              models: [],
              status: 'idle' as const,
              ...s.keys[providerId],
              ...patch,
              providerId,
            },
          },
        })),

      addAgent: (a) =>
        set((s) => ({
          agents: [...s.agents, { ...a, id: uid(), isDirector: s.agents.length === 0 ? true : a.isDirector }],
        })),
      updateAgent: (id, patch) =>
        set((s) => ({ agents: s.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
      removeAgent: (id) => set((s) => ({ agents: s.agents.filter((a) => a.id !== id) })),
      setDirector: (id) =>
        set((s) => ({ agents: s.agents.map((a) => ({ ...a, isDirector: a.id === id })) })),

      addTarget: (url, note) =>
        set((s) => ({ targets: [...s.targets, { id: uid(), url: url.trim(), note }] })),
      removeTarget: (id) => set((s) => ({ targets: s.targets.filter((t) => t.id !== id) })),

      setMission: (mission) => set({ mission }),
      setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),

      pushEvent: (e) => set((s) => ({ events: [...s.events, e].slice(-2000) })),
      clearEvents: () => set({ events: [], runtime: {} }),
      setRuntime: (runtime) => set({ runtime }),
      setRunning: (running) => set({ running }),
      setShowTerminal: (showTerminal) => set({ showTerminal }),
      setSidebarTab: (sidebarTab) => set({ sidebarTab }),
      setRightTab: (rightTab) => set({ rightTab }),
    }),
    {
      name: 'nexus-swarm',
      partialize: (s) => ({
        keys: s.keys,
        agents: s.agents,
        targets: s.targets,
        mission: s.mission,
        config: s.config,
      }),
    }
  )
);
