'use client';

import { useStore } from '@/lib/store';

export default function MissionPanel() {
  const { mission, setMission } = useStore();
  return (
    <div className="p-3 space-y-2">
      <div className="text-[10px] uppercase tracking-widest text-mute px-1">Mission</div>
      <textarea
        value={mission}
        onChange={(e) => setMission(e.target.value)}
        placeholder="What should the swarm accomplish? Be concrete. Example: 'Map the login flow on the target, enumerate every form field and endpoint, write findings to /recon/login.md'."
        rows={6}
        className="w-full bg-void border border-edge rounded px-2.5 py-2 text-[12px] focus:border-acid/50 outline-none resize-y leading-relaxed"
      />
    </div>
  );
}
