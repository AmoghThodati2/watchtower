import { useState, useEffect } from 'react';
import { useStore } from '../state/store';
import { Conjunction } from '../ontology/types';
import { formatCountdownHuman, formatDistance, pcColor, pcSeverity } from '../lib/format';
import { ArrowUpDown, Filter, CheckCircle2, AlertTriangle, Shield, Clock } from 'lucide-react';
import { cn } from '../lib/utils';

const STATUS_ICON = {
  NEW: () => <AlertTriangle size={11} style={{ color: 'var(--accent-amber)' }} />,
  TRIAGED: () => <Clock size={11} style={{ color: 'var(--accent-cyan)' }} />,
  MITIGATED: () => <CheckCircle2 size={11} style={{ color: 'var(--accent-green)' }} />,
  ACCEPTED: () => <Shield size={11} style={{ color: 'var(--text-tertiary)' }} />,
};

function PcDot({ pc }: { pc: number }) {
  const color = pcColor(pc);
  const sev = pcSeverity(pc);
  return (
    <span
      className="inline-block rounded-full"
      style={{
        width: 8,
        height: 8,
        background: color,
        boxShadow: sev === 'red' ? `0 0 6px ${color}` : undefined,
        animation: sev === 'red' ? 'pulse-ring 2s infinite' : undefined,
      }}
    />
  );
}

function CdmRow({ conj, selected, onClick }: { conj: Conjunction; selected: boolean; onClick: () => void }) {
  const [countdown, setCountdown] = useState(formatCountdownHuman(conj.tca));
  const StatusIcon = STATUS_ICON[conj.status];

  useEffect(() => {
    const id = setInterval(() => setCountdown(formatCountdownHuman(conj.tca)), 10000);
    return () => clearInterval(id);
  }, [conj.tca]);

  const pcSev = pcSeverity(conj.probabilityOfCollision);
  const isHighRisk = pcSev === 'red';

  return (
    <div
      className={cn('cdm-row px-4 py-3 cursor-pointer', selected && 'selected')}
      onClick={onClick}
      style={{
        borderBottom: '1px solid var(--border-subtle)',
        position: 'relative',
      }}
    >
      {/* Header row: satellite names */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <StatusIcon />
          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            {conj.primary.name}
          </span>
          <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>↔</span>
          <span className="text-xs font-semibold" style={{ color: isHighRisk ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
            {'name' in conj.secondary ? conj.secondary.name : 'UNKNOWN'}
          </span>
        </div>
        {conj.status === 'MITIGATED' && (
          <CheckCircle2 size={13} style={{ color: 'var(--accent-green)' }} />
        )}
      </div>

      {/* Second row: TCA + Pc */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs tabular" style={{ color: 'var(--text-tertiary)' }}>TCA</span>
          <span className="font-mono text-xs tabular" style={{ color: 'var(--accent-amber)' }}>{countdown}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <PcDot pc={conj.probabilityOfCollision} />
          <span className="font-mono text-xs tabular" style={{ color: pcColor(conj.probabilityOfCollision) }}>
            P_c {conj.probabilityOfCollision.toExponential(1)}
          </span>
        </div>
      </div>

      {/* Third row: miss distance + rel velocity */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs tabular" style={{ color: 'var(--text-secondary)' }}>
          Miss {formatDistance(conj.missDistanceM)}
        </span>
        <span className="font-mono text-xs tabular" style={{ color: 'var(--text-tertiary)' }}>
          δv {conj.relativeVelocityKmS.toFixed(1)} km/s
        </span>
      </div>

      {/* Left glow for selected */}
      {selected && (
        <div
          style={{
            position: 'absolute',
            left: 0, top: 0, bottom: 0,
            width: 2,
            background: 'var(--accent-cyan)',
            boxShadow: '0 0 8px var(--accent-cyan)',
          }}
        />
      )}
    </div>
  );
}

export function CdmQueue() {
  const { conjunctions, selectedCdmId, sortKey, filterOwned, setSortKey, setFilterOwned, selectConjunction } = useStore();

  const sorted = [...conjunctions].sort((a, b) => {
    if (sortKey === 'TCA') return new Date(a.tca).getTime() - new Date(b.tca).getTime();
    if (sortKey === 'PC') return b.probabilityOfCollision - a.probabilityOfCollision;
    if (sortKey === 'MISS') return a.missDistanceM - b.missDistanceM;
    return 0;
  });

  const newCount = conjunctions.filter((c) => c.status === 'NEW').length;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-panel)' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wider" style={{ color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>
              CDM QUEUE
            </span>
            {newCount > 0 && (
              <span
                className="text-xs font-mono px-1.5 py-0.5 rounded"
                style={{
                  background: 'rgba(255, 56, 56, 0.15)',
                  color: 'var(--accent-red)',
                  border: '1px solid rgba(255, 56, 56, 0.25)',
                }}
              >
                {newCount} NEW
              </span>
            )}
          </div>
          <span className="font-mono text-xs tabular" style={{ color: 'var(--text-tertiary)' }}>
            {conjunctions.length}
          </span>
        </div>

        {/* Sort buttons */}
        <div className="flex items-center gap-1 mb-2">
          {(['TCA', 'PC', 'MISS'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setSortKey(k)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors"
              style={{
                background: sortKey === k ? 'rgba(0, 212, 255, 0.1)' : 'var(--bg-elevated)',
                color: sortKey === k ? 'var(--accent-cyan)' : 'var(--text-tertiary)',
                border: `1px solid ${sortKey === k ? 'rgba(0, 212, 255, 0.25)' : 'var(--border-subtle)'}`,
              }}
            >
              <ArrowUpDown size={10} />
              {k === 'PC' ? 'P_c' : k === 'MISS' ? 'Miss' : 'TCA'}
            </button>
          ))}
        </div>

        {/* Filter */}
        <button
          onClick={() => setFilterOwned(!filterOwned)}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors"
          style={{
            background: filterOwned ? 'rgba(0, 212, 255, 0.08)' : 'transparent',
            color: filterOwned ? 'var(--accent-cyan)' : 'var(--text-tertiary)',
            border: `1px solid ${filterOwned ? 'rgba(0, 212, 255, 0.2)' : 'var(--border-subtle)'}`,
          }}
        >
          <Filter size={10} />
          Owned only
        </button>
      </div>

      {/* Queue list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Loading CDM queue…</span>
          </div>
        ) : (
          sorted.map((conj) => (
            <CdmRow
              key={conj.cdmId}
              conj={conj}
              selected={selectedCdmId === conj.cdmId}
              onClick={() => selectConjunction(conj.cdmId)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <span className="font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Data: Space-Track · Celestrak
        </span>
      </div>
    </div>
  );
}
