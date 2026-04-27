import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../state/store';
import { format, addHours } from 'date-fns';
import { CheckCircle2, X, Zap, AlertTriangle } from 'lucide-react';

type Phase = 'confirm' | 'executing' | 'done';

const LOG_LINES_BASE = [
  'CDM-{ID} → status: MITIGATING',
  'Generating maneuver command for {SAT}',
  'Δv vector computed: [{DV_X}, -{DV_Y}, +{DV_Z}] m/s',
  'Burn time: {BURN_TIME} UTC',
  'Command package signed [SHA-256: a7f2…]',
  'Routed to Arclight ground station network',
  'Acknowledgment received: SVALBARD-TT&C',
  'CDM-{ID} → status: MITIGATED',
];

function formatDvComponent(v: number): string {
  return `+${v.toFixed(2)}`;
}

export function ExecuteOverlay() {
  const { showExecuteOverlay, executingOption, selectedCdmId, conjunctions, closeExecuteOverlay, executeManeuver } = useStore();
  const [phase, setPhase] = useState<Phase>('confirm');
  const [logLines, setLogLines] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const conjunction = conjunctions.find((c) => c.cdmId === selectedCdmId);

  useEffect(() => {
    if (!showExecuteOverlay) {
      setPhase('confirm');
      setLogLines([]);
    }
  }, [showExecuteOverlay]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logLines]);

  if (!showExecuteOverlay || !executingOption || !conjunction) return null;

  const opt = executingOption;
  const burnTimeStr = format(new Date(opt.burnTime), "yyyy-MM-dd HH:mm:ss");
  const dvX = formatDvComponent(opt.deltaVMs * 0.82);
  const dvY = (opt.deltaVMs * 0.71).toFixed(2);
  const dvZ = formatDvComponent(opt.deltaVMs * 0.19);
  const cdmShort = conjunction.cdmId.split('-').slice(-1)[0];

  const lines = LOG_LINES_BASE.map((l) =>
    l
      .replace('{ID}', conjunction.cdmId)
      .replace('{SAT}', conjunction.primary.name)
      .replace('{DV_X}', dvX)
      .replace('{DV_Y}', dvY)
      .replace('{DV_Z}', dvZ)
      .replace('{BURN_TIME}', burnTimeStr)
  );

  const handleConfirm = async () => {
    setPhase('executing');
    for (let i = 0; i < lines.length; i++) {
      await new Promise((r) => setTimeout(r, 650 + Math.random() * 200));
      const ts = format(new Date(), 'HH:mm:ss');
      setLogLines((prev) => [...prev, `[${ts}] ${lines[i]}`]);
    }
    await new Promise((r) => setTimeout(r, 400));
    setPhase('done');
    executeManeuver(opt, conjunction.cdmId);
  };

  const handleClose = () => {
    closeExecuteOverlay();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 flex items-center justify-center"
        style={{ zIndex: 200, background: 'rgba(10, 14, 20, 0.92)', backdropFilter: 'blur(4px)' }}
      >
        {phase === 'confirm' && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="rounded-xl p-8 max-w-md w-full mx-4"
            style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-default)',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.6)',
            }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255, 176, 32, 0.12)', border: '1px solid rgba(255, 176, 32, 0.3)' }}
              >
                <AlertTriangle size={18} style={{ color: 'var(--accent-amber)' }} />
              </div>
              <div>
                <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>Confirm Maneuver</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>This action cannot be undone</div>
              </div>
            </div>

            <div
              className="rounded-lg p-4 mb-6"
              style={{ background: 'var(--bg-void)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="text-sm font-semibold mb-3" style={{ color: 'var(--accent-cyan)' }}>
                Execute Option {opt.label} for {conjunction.primary.name}
              </div>
              <div className="space-y-2">
                <InfoRow label="Δv" value={`${opt.deltaVMs} m/s`} />
                <InfoRow label="Fuel cost" value={`${opt.fuelCostKg} kg`} />
                <InfoRow label="Mission life impact" value={`−${opt.missionLifeImpactDays} days`} color="var(--accent-amber)" />
                <InfoRow label="Burn time" value={burnTimeStr + ' UTC'} />
                <InfoRow label="New miss distance" value={`${opt.newMissDistanceM}m`} color="var(--accent-green)" />
                <InfoRow label="New P_c" value={opt.newPc.toExponential(2)} color="var(--accent-green)" />
              </div>
            </div>

            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              This will burn <strong>{opt.fuelCostKg} kg</strong> of propellant and shift the mission timeline
              by <strong>{opt.missionLifeImpactDays} days</strong>. The burn command will be signed and
              routed to Arclight's TT&C network for uplink on next pass.
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 rounded text-sm font-medium transition-colors"
                style={{
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-default)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-2.5 rounded text-sm font-semibold transition-all"
                style={{
                  background: 'linear-gradient(135deg, #00D4FF, #0090cc)',
                  color: 'var(--bg-void)',
                  boxShadow: '0 0 20px rgba(0, 212, 255, 0.3)',
                }}
              >
                <div className="flex items-center justify-center gap-2">
                  <Zap size={14} />
                  Confirm & Execute
                </div>
              </button>
            </div>
          </motion.div>
        )}

        {(phase === 'executing' || phase === 'done') && (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-xl p-6 w-full max-w-lg mx-4"
            style={{
              background: '#0A0E14',
              border: '1px solid rgba(0, 230, 118, 0.25)',
              boxShadow: '0 0 40px rgba(0, 230, 118, 0.08)',
            }}
          >
            {/* Terminal header */}
            <div
              className="flex items-center gap-2 mb-4 pb-3"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#FF5F57' }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#FFBD2E' }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#27C93F' }} />
              </div>
              <span className="font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>
                arclight-ttc — maneuver-exec
              </span>
            </div>

            {/* Log lines */}
            <div ref={logRef} className="overflow-y-auto space-y-0.5" style={{ maxHeight: 280 }}>
              {logLines.map((line, i) => {
                const isMitigated = line.includes('MITIGATED');
                const isStatus = line.includes('status:');
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.1 }}
                    className="terminal-line"
                    style={{
                      color: isMitigated ? 'var(--accent-green)' : isStatus ? 'var(--accent-amber)' : 'var(--accent-green)',
                      opacity: isMitigated ? 1 : 0.85,
                    }}
                  >
                    {line}
                  </motion.div>
                );
              })}
              {phase === 'executing' && (
                <div className="terminal-line" style={{ color: 'var(--text-tertiary)' }}>
                  <span className="animate-pulse">_</span>
                </div>
              )}
            </div>

            {phase === 'done' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-6 pt-4"
                style={{ borderTop: '1px solid rgba(0, 230, 118, 0.2)' }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle2 size={20} style={{ color: 'var(--accent-green)' }} />
                  <div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--accent-green)' }}>
                      Maneuver Scheduled
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {conjunction.primary.name} will burn at {format(new Date(opt.burnTime), 'HH:mm')} UTC
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="w-full py-2 rounded text-sm font-medium"
                  style={{
                    background: 'rgba(0, 230, 118, 0.1)',
                    color: 'var(--accent-green)',
                    border: '1px solid rgba(0, 230, 118, 0.25)',
                  }}
                >
                  Close
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function InfoRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <span className="font-mono text-xs tabular font-semibold" style={{ color: color || 'var(--text-primary)' }}>
        {value}
      </span>
    </div>
  );
}
