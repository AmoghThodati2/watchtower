import { ManeuverOption, AgentRecommendation } from '../../ontology/types';
import { formatPc, formatDistance, formatDeltaV, formatFuel, formatMissionImpact } from '../../lib/format';
import { useStore } from '../../state/store';
import { Zap, Star, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

type Props = {
  options: ManeuverOption[];
  recommendation?: AgentRecommendation;
  conjunctionId: string;
};

const RISK_CONFIG = {
  LOW: { color: 'var(--accent-green)', bg: 'rgba(0, 230, 118, 0.1)', icon: CheckCircle2 },
  MEDIUM: { color: 'var(--accent-amber)', bg: 'rgba(255, 176, 32, 0.1)', icon: AlertTriangle },
  HIGH: { color: 'var(--accent-red)', bg: 'rgba(255, 56, 56, 0.1)', icon: AlertTriangle },
};

function OptionCard({
  option,
  isRecommended,
  onExecute,
}: {
  option: ManeuverOption;
  isRecommended: boolean;
  onExecute: () => void;
}) {
  const risk = RISK_CONFIG[option.riskLevel];
  const RiskIcon = risk.icon;

  return (
    <div
      className="rounded p-4 relative"
      style={{
        background: isRecommended ? 'rgba(167, 139, 250, 0.06)' : 'var(--bg-void)',
        border: isRecommended
          ? '1px solid rgba(167, 139, 250, 0.35)'
          : '1px solid var(--border-subtle)',
        boxShadow: isRecommended ? '0 0 16px rgba(167, 139, 250, 0.08)' : undefined,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded flex items-center justify-center font-mono font-bold text-sm"
            style={{
              background: isRecommended ? 'rgba(167, 139, 250, 0.2)' : 'var(--bg-elevated)',
              color: isRecommended ? 'var(--accent-violet)' : 'var(--text-primary)',
            }}
          >
            {option.label}
          </div>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Option {option.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
            style={{ background: risk.bg, color: risk.color }}
          >
            <RiskIcon size={10} />
            {option.riskLevel}
          </div>
          {isRecommended && (
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold"
              style={{
                background: 'rgba(167, 139, 250, 0.15)',
                color: 'var(--accent-violet)',
                border: '1px solid rgba(167, 139, 250, 0.3)',
              }}
            >
              <Star size={9} fill="currentColor" />
              RECOMMENDED
            </div>
          )}
        </div>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
        <Metric label="Δv" value={formatDeltaV(option.deltaVMs)} highlight />
        <Metric label="Fuel Cost" value={formatFuel(option.fuelCostKg)} />
        <Metric label="New Miss Dist" value={formatDistance(option.newMissDistanceM)} color="var(--accent-green)" />
        <Metric label="New P_c" value={formatPc(option.newPc)} color="var(--accent-green)" />
        <Metric label="Mission Impact" value={formatMissionImpact(option.missionLifeImpactDays)} />
        <div className="flex flex-col gap-0.5">
          <span className="text-xs" style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>BURN TIME</span>
          <div className="flex items-center gap-1">
            <Clock size={10} style={{ color: 'var(--text-tertiary)' }} />
            <span className="font-mono text-xs tabular" style={{ color: 'var(--text-secondary)' }}>
              T-{Math.round((new Date(option.burnTime).getTime() - Date.now()) / 3600000)}h
            </span>
          </div>
        </div>
      </div>

      {/* Ground track impact */}
      <div
        className="rounded p-2 mb-3"
        style={{ background: 'rgba(255, 176, 32, 0.05)', border: '1px solid rgba(255, 176, 32, 0.12)' }}
      >
        <div className="flex items-start gap-1.5">
          <AlertTriangle size={11} style={{ color: 'var(--accent-amber)', marginTop: 1 }} />
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {option.groundTrackImpact}
          </span>
        </div>
      </div>

      {/* Execute button */}
      <button
        onClick={onExecute}
        className="w-full py-2.5 rounded font-semibold text-sm transition-all"
        style={{
          background: isRecommended
            ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.9), rgba(0, 212, 255, 0.7))'
            : 'var(--bg-elevated)',
          color: isRecommended ? 'var(--bg-void)' : 'var(--text-secondary)',
          border: isRecommended ? 'none' : '1px solid var(--border-default)',
          boxShadow: isRecommended ? '0 0 20px rgba(0, 212, 255, 0.3)' : undefined,
        }}
      >
        <div className="flex items-center justify-center gap-2">
          <Zap size={14} />
          GENERATE BURN PLAN — OPTION {option.label}
        </div>
      </button>
    </div>
  );
}

function Metric({ label, value, highlight, color }: { label: string; value: string; highlight?: boolean; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs" style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>{label}</span>
      <span
        className="font-mono text-xs tabular font-semibold"
        style={{ color: color || (highlight ? 'var(--text-primary)' : 'var(--text-secondary)') }}
      >
        {value}
      </span>
    </div>
  );
}

export function ManeuverOptionsTab({ options, recommendation, conjunctionId }: Props) {
  const { openExecuteOverlay } = useStore();

  if (options.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Zap size={24} style={{ color: 'var(--text-tertiary)', margin: '0 auto 8px' }} />
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            Go to Agent Reasoning tab to generate options
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          MANEUVER OPTIONS
        </span>
        <span className="text-xs font-mono tabular" style={{ color: 'var(--text-tertiary)' }}>
          {options.length} OPTIONS
        </span>
      </div>

      {options.map((opt) => (
        <OptionCard
          key={opt.id}
          option={opt}
          isRecommended={recommendation?.recommendedOptionId === opt.id}
          onExecute={() => openExecuteOverlay(opt)}
        />
      ))}
    </div>
  );
}
