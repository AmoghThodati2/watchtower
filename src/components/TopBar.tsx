import { useEffect, useState } from 'react';
import { formatUTC } from '../lib/format';
import { Satellite, Radio, ChevronDown, Circle } from 'lucide-react';

export function TopBar() {
  const [utc, setUtc] = useState(formatUTC());

  useEffect(() => {
    const id = setInterval(() => setUtc(formatUTC()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header
      className="flex items-center justify-between px-5 h-12 shrink-0"
      style={{
        background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border-subtle)',
        zIndex: 50,
      }}
    >
      {/* Left: logo + system name */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Satellite size={18} style={{ color: 'var(--accent-cyan)' }} />
            <span
              className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--accent-green)' }}
            />
          </div>
          <span
            className="font-mono text-sm font-semibold tracking-widest"
            style={{ color: 'var(--accent-cyan)', letterSpacing: '0.2em' }}
          >
            WATCHTOWER
          </span>
        </div>
        <span style={{ color: 'var(--border-default)' }}>·</span>
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Arclight Mission Ops
        </span>
        <span style={{ color: 'var(--border-default)' }}>·</span>
        <span className="font-mono text-xs tabular" style={{ color: 'var(--text-tertiary)' }}>
          {utc}
        </span>
      </div>

      {/* Right: user + status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Circle
            size={7}
            fill="var(--accent-green)"
            style={{ color: 'var(--accent-green)' }}
            className="animate-pulse"
          />
          <span className="text-xs font-mono" style={{ color: 'var(--accent-green)' }}>
            NOMINAL
          </span>
        </div>
        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded text-xs cursor-pointer"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
        >
          <Radio size={12} />
          <span>SVALBARD TT&C</span>
          <Circle size={6} fill="var(--accent-green)" style={{ color: 'var(--accent-green)' }} />
        </div>
        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded text-xs cursor-pointer hover:bg-elevated transition-colors"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
        >
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold"
            style={{ background: 'var(--accent-cyan)', color: 'var(--bg-void)' }}
          >
            M
          </div>
          <span>Marcus Chen</span>
          <ChevronDown size={12} />
        </div>
      </div>
    </header>
  );
}
