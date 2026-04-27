import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { streamAgentReasoning } from '../../lib/agent';
import { Conjunction, ManeuverOption } from '../../ontology/types';
import { Brain, Zap, AlertCircle, CheckCircle2 } from 'lucide-react';

type Props = {
  conjunction: Conjunction;
  options: ManeuverOption[];
};

function ReasoningDisplay({ text }: { text: string }) {
  // Parse structured sections
  const formatted = text
    .replace(/^(ASSESSMENT|KEY FACTORS|OPTIONS ANALYSIS|RECOMMENDATION|CONFIDENCE):/gm, '§§§$1:')
    .split('§§§');

  return (
    <div className="space-y-3">
      {formatted.map((block, i) => {
        if (!block.trim()) return null;
        const colonIdx = block.indexOf(':');
        if (colonIdx === -1 || colonIdx > 30) {
          return (
            <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {block}
            </p>
          );
        }
        const header = block.slice(0, colonIdx);
        const body = block.slice(colonIdx + 1).trim();
        return (
          <div key={i}>
            <div
              className="text-xs font-semibold tracking-wider mb-1.5 font-mono"
              style={{ color: 'var(--accent-violet)', letterSpacing: '0.08em' }}
            >
              {header}
            </div>
            <div
              className="text-sm leading-relaxed whitespace-pre-wrap"
              style={{ color: 'var(--text-secondary)' }}
            >
              {body}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ConfidenceMeter({ confidence }: { confidence: number }) {
  const color = confidence >= 80 ? 'var(--accent-green)' : confidence >= 60 ? 'var(--accent-amber)' : 'var(--accent-red)';
  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <div className="relative w-14 h-14">
        <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
          <circle cx="28" cy="28" r="22" fill="none" stroke="var(--border-default)" strokeWidth="4" />
          <circle
            cx="28" cy="28" r="22"
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeDasharray={`${confidence * 1.382} 138.2`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-xs font-bold tabular" style={{ color }}>{confidence}</span>
        </div>
      </div>
      <span className="text-xs" style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>CONFIDENCE</span>
    </div>
  );
}

export function AgentReasoningTab({ conjunction, options }: Props) {
  const {
    agentState,
    agentReasoning,
    recommendations,
    startAgentStream,
    appendAgentReasoning,
    completeAgentReasoning,
    failAgentReasoning,
  } = useStore();

  const cdmId = conjunction.cdmId;
  const state = agentState[cdmId] || 'IDLE';
  const reasoning = agentReasoning[cdmId] || '';
  const rec = recommendations[cdmId];
  const endRef = useRef<HTMLDivElement>(null);
  const [activeFactor, setActiveFactor] = useState<string | null>(null);

  useEffect(() => {
    if (endRef.current && state === 'STREAMING') {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [reasoning, state]);

  const handleInvoke = async () => {
    if (state === 'STREAMING') return;
    startAgentStream(cdmId);

    await streamAgentReasoning(
      conjunction,
      options,
      (chunk) => appendAgentReasoning(cdmId, chunk),
      (rec) => completeAgentReasoning(cdmId, rec),
      () => failAgentReasoning(cdmId)
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain size={14} style={{ color: 'var(--accent-violet)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--accent-violet)' }}>
              SPACEFLIGHT SAFETY AGENT
            </span>
            {state === 'STREAMING' && (
              <div className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1 h-1 rounded-full"
                    style={{
                      background: 'var(--accent-violet)',
                      animation: `pulse 1.2s ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            )}
            {state === 'DONE' && (
              <CheckCircle2 size={12} style={{ color: 'var(--accent-green)' }} />
            )}
            {state === 'ERROR' && (
              <AlertCircle size={12} style={{ color: 'var(--accent-amber)' }} />
            )}
          </div>
          {rec && <ConfidenceMeter confidence={rec.confidence} />}
        </div>

        {/* Citation chips */}
        {rec && rec.citedFactors.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {rec.citedFactors.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFactor(activeFactor === f ? null : f)}
                className="px-2 py-0.5 rounded text-xs transition-colors"
                style={{
                  background: activeFactor === f ? 'rgba(167, 139, 250, 0.2)' : 'rgba(167, 139, 250, 0.08)',
                  color: 'var(--accent-violet)',
                  border: '1px solid rgba(167, 139, 250, 0.2)',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Reasoning content */}
      <div className="flex-1 overflow-y-auto p-4">
        {state === 'IDLE' && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(167, 139, 250, 0.1)', border: '1px solid rgba(167, 139, 250, 0.2)' }}
            >
              <Brain size={24} style={{ color: 'var(--accent-violet)' }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                Invoke Spaceflight Safety Agent
              </p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                AI-powered analysis of CDM data, maneuver tradeoffs, and operational constraints
              </p>
            </div>
            <button
              onClick={handleInvoke}
              className="flex items-center gap-2 px-5 py-2.5 rounded font-semibold text-sm transition-all"
              style={{
                background: 'rgba(167, 139, 250, 0.15)',
                color: 'var(--accent-violet)',
                border: '1px solid rgba(167, 139, 250, 0.35)',
                boxShadow: '0 0 16px rgba(167, 139, 250, 0.1)',
              }}
            >
              <Zap size={14} />
              Invoke Agent
            </button>
          </div>
        )}

        {(state === 'STREAMING' || state === 'DONE' || state === 'ERROR') && reasoning && (
          <div>
            <ReasoningDisplay text={reasoning} />
            {state === 'STREAMING' && (
              <span
                className="inline-block w-0.5 h-4 ml-0.5 animate-pulse"
                style={{ background: 'var(--accent-violet)', verticalAlign: 'middle' }}
              />
            )}
            <div ref={endRef} />
          </div>
        )}

        {state === 'STREAMING' && !reasoning && (
          <div className="flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
            <div className="flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: 'var(--accent-violet)', animation: `pulse 1s ${i * 0.15}s infinite` }}
                />
              ))}
            </div>
            <span className="text-xs">Agent analyzing CDM data…</span>
          </div>
        )}
      </div>

      {/* Re-invoke button when done */}
      {(state === 'DONE' || state === 'ERROR') && (
        <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={handleInvoke}
            className="flex items-center gap-2 text-xs transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <Zap size={11} />
            Re-analyze
          </button>
        </div>
      )}
    </div>
  );
}
