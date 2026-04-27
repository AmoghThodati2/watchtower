import { useEffect, useState } from 'react';
import { Conjunction, isDebrisObject } from '../../ontology/types';
import { formatPc, formatDistance, formatCountdown, formatUTCShort, pcColor } from '../../lib/format';
import { Satellite, Trash2, AlertTriangle } from 'lucide-react';

type Props = { conjunction: Conjunction };

function StatBox({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <div
      className="flex flex-col gap-0.5 px-3 py-2 rounded"
      style={{ background: 'var(--bg-void)', border: '1px solid var(--border-subtle)' }}
    >
      <span className="text-xs" style={{ color: 'var(--text-tertiary)', fontSize: 10, letterSpacing: '0.06em' }}>
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-sm tabular font-semibold" style={{ color: color || 'var(--text-primary)' }}>
          {value}
        </span>
        {unit && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{unit}</span>}
      </div>
    </div>
  );
}

function ObjectCard({ title, obj, isPrimary }: { title: string; obj: Conjunction['primary'] | Conjunction['secondary']; isPrimary: boolean }) {
  const isDebris = isDebrisObject(obj);
  const color = isPrimary ? 'var(--accent-cyan)' : 'var(--accent-red)';

  return (
    <div
      className="flex-1 rounded p-3"
      style={{ background: 'var(--bg-void)', border: `1px solid ${isPrimary ? 'rgba(0,212,255,0.2)' : 'rgba(255,56,56,0.2)'}` }}
    >
      <div className="flex items-center gap-1.5 mb-3">
        {isDebris
          ? <Trash2 size={13} style={{ color }} />
          : <Satellite size={13} style={{ color }} />
        }
        <span className="text-xs font-semibold" style={{ color }}>{title}</span>
      </div>

      <div className="space-y-2">
        <Row label="Name" value={'name' in obj ? obj.name : '—'} mono />
        {!isDebris && (
          <>
            <Row label="Operator" value={(obj as Conjunction['primary']).operator} />
            <Row label="Criticality" value={(obj as Conjunction['primary']).missionCriticality} color={color} />
            {(obj as Conjunction['primary']).fuelRemainingKg !== undefined && (
              <Row label="Fuel" value={`${(obj as Conjunction['primary']).fuelRemainingKg?.toFixed(1)} kg`} mono />
            )}
            {(obj as Conjunction['primary']).priorManeuverCount !== undefined && (
              <Row label="Prior Maneuvers" value={String((obj as Conjunction['primary']).priorManeuverCount)} mono />
            )}
            {(obj as Conjunction['primary']).mission && (
              <Row label="Mission" value={(obj as Conjunction['primary']).mission!} small />
            )}
          </>
        )}
        {isDebris && (
          <>
            <Row label="Parent Event" value={(obj as { parentEvent: string }).parentEvent} small />
            <Row label="Est. Size" value={`~${(obj as { estimatedSizeM: number }).estimatedSizeM.toFixed(2)} m`} mono />
            <Row label="NORAD ID" value={String(obj.noradId)} mono />
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono, small, color }: { label: string; value: string; mono?: boolean; small?: boolean; color?: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs shrink-0" style={{ color: 'var(--text-tertiary)', fontSize: small ? 10 : 11 }}>
        {label}
      </span>
      <span
        className={`text-right ${mono ? 'font-mono tabular' : ''}`}
        style={{ fontSize: small ? 11 : 12, color: color || 'var(--text-secondary)', maxWidth: '60%' }}
      >
        {value}
      </span>
    </div>
  );
}

export function OverviewTab({ conjunction }: Props) {
  const [countdown, setCountdown] = useState(formatCountdown(conjunction.tca));

  useEffect(() => {
    const id = setInterval(() => setCountdown(formatCountdown(conjunction.tca)), 1000);
    return () => clearInterval(id);
  }, [conjunction.tca]);

  const hoursToTCA = (new Date(conjunction.tca).getTime() - Date.now()) / 3600000;
  const urgency = conjunction.probabilityOfCollision >= 1e-3 ? 'CRITICAL' : conjunction.probabilityOfCollision >= 1e-4 ? 'HIGH' : 'MODERATE';
  const urgencyColor = urgency === 'CRITICAL' ? 'var(--accent-red)' : urgency === 'HIGH' ? 'var(--accent-amber)' : 'var(--accent-cyan)';

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      {/* Countdown — hero element */}
      <div
        className="rounded p-4 text-center"
        style={{ background: 'var(--bg-void)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          <AlertTriangle size={13} style={{ color: urgencyColor }} />
          <span className="text-xs font-semibold tracking-wider" style={{ color: urgencyColor }}>
            {urgency}
          </span>
        </div>
        <div
          className="font-mono text-3xl tabular font-semibold"
          style={{ color: urgencyColor, letterSpacing: '0.04em', textShadow: `0 0 20px ${urgencyColor}40` }}
        >
          {countdown}
        </div>
        <div className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
          time to closest approach
        </div>
        <div className="text-xs mt-0.5 font-mono tabular" style={{ color: 'var(--text-secondary)' }}>
          TCA: {formatUTCShort(conjunction.tca)}
        </div>
      </div>

      {/* Quick stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatBox
          label="MISS DISTANCE"
          value={formatDistance(conjunction.missDistanceM)}
          color={conjunction.missDistanceM < 500 ? 'var(--accent-red)' : 'var(--text-primary)'}
        />
        <StatBox
          label="PROBABILITY OF COLLISION"
          value={formatPc(conjunction.probabilityOfCollision)}
          color={pcColor(conjunction.probabilityOfCollision)}
        />
        <StatBox
          label="RELATIVE VELOCITY"
          value={conjunction.relativeVelocityKmS.toFixed(2)}
          unit="km/s"
        />
        <StatBox
          label="CDM ID"
          value={conjunction.cdmId.split('-').slice(-1)[0]}
        />
      </div>

      {/* Object cards */}
      <div className="flex gap-3">
        <ObjectCard title="PRIMARY" obj={conjunction.primary} isPrimary={true} />
        <ObjectCard title="SECONDARY" obj={conjunction.secondary} isPrimary={false} />
      </div>

      {/* CDM metadata */}
      <div
        className="rounded p-3"
        style={{ background: 'var(--bg-void)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
          CDM METADATA
        </div>
        <div className="space-y-1.5">
          <Row label="CDM ID" value={conjunction.cdmId} mono />
          <Row label="Received" value={formatUTCShort(conjunction.receivedAt)} mono small />
          <Row label="Status" value={conjunction.status} color={urgencyColor} />
          <Row label="Data Source" value="Space-Track / CSpOC" />
        </div>
      </div>
    </div>
  );
}
