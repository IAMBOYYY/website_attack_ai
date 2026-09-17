'use client';

import { useEffect, useState } from 'react';
import { File, Trash2, RefreshCw } from 'lucide-react';
import { vfs } from '@/lib/vfs';
import type { VFile } from '@/lib/types';

export default function FileExplorer() {
  const [files, setFiles] = useState<VFile[]>([]);
  const [open, setOpen] = useState<VFile | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const f = await vfs.list('/');
      if (alive) setFiles(f);
    };
    load();
    const id = setInterval(load, 2000);
    return () => { alive = false; clearInterval(id); };
  }, [tick]);

  const remove = async (p: string) => {
    await vfs.remove(p);
    setTick((t) => t + 1);
    if (open?.path === p) setOpen(null);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-edge">
        <span className="text-[10px] uppercase tracking-widest text-mute flex-1">
          workspace · {files.length} file{files.length === 1 ? '' : 's'}
        </span>
        <button onClick={() => setTick((t) => t + 1)} className="text-mute hover:text-dim">
          <RefreshCw size={11} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {files.length === 0 ? (
          <div className="p-3 text-[11px] text-mute">Empty. Agents write here as they work.</div>
        ) : (
          files.map((f) => (
            <div
              key={f.path}
              className={`group flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.02] cursor-pointer text-[11px] font-mono ${open?.path === f.path ? 'bg-acid/[0.06] text-acid' : 'text-dim'}`}
              onClick={() => setOpen(f)}
            >
              <File size={11} className="shrink-0 opacity-60" />
              <span className="flex-1 truncate">{f.path}</span>
              <span className="text-mute text-[9px]">{f.content.length}b</span>
              <button
                onClick={(e) => { e.stopPropagation(); remove(f.path); }}
                className="opacity-0 group-hover:opacity-100 text-mute hover:text-red transition"
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))
        )}
      </div>

      {open && (
        <div className="border-t border-edge max-h-[55%] flex flex-col">
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-edge bg-black/30">
            <span className="text-[10px] font-mono text-acid flex-1 truncate">{open.path}</span>
            <button onClick={() => setOpen(null)} className="text-mute hover:text-dim text-[10px]">close</button>
          </div>
          <pre className="flex-1 overflow-auto p-3 text-[11px] font-mono text-dim whitespace-pre-wrap break-words">
            {open.content}
          </pre>
        </div>
      )}
    </div>
  );
}
