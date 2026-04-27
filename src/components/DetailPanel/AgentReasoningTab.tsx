import { useEffect, useRef, useMemo } from 'react';
import { useStore } from '../../state/store';
import { streamAgentReasoning } from '../../lib/agent';
import { Conjunction, ManeuverOption } from '../../ontology/types';
import { Brain, Zap, AlertCircle, CheckCircle2 } from 'lucide-react';

type Props = {
  conjunction: Conjunction;
  options: ManeuverOption[];
};

// ── Parser ────────────────────────────────────────────────────────────────────
// Handles both plain "SECTION:" and markdown-bold "**SECTION:**" output from the LLM.

interface ParsedReasoning {
  assessment: string;
  keyFactors: string[];
  optionsAnalysis: string;
  recommendation: string;
  confidence: number | null;
}

function parseReasoningText(text: string): ParsedReasoning {
  // Strip all markdown bold/italic so **SECTION:** and SECTION: are treated identically.
  const clean = text.replace(/\*\*/g, '').replace(/\*([^*\n]+)\*/g, '$1');

  // Walk through every section header and capture the text between them.
  const headerRe = /(?:^|\n)(ASSESSMENT|KEY FACTORS|OPTIONS ANALYSIS|RECOMMENDATION|CONFIDENCE)\s*:/gi;
  const sections: Record<string, string> = {};
  let lastKey = '';
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = headerRe.exec(clean)) !== null) {
    if (lastKey) sections[lastKey] = clean.slice(lastIdx, match.index).trim();
    lastKey = match[1].toUpperCase();
    lastIdx = match.index + match[0].length;
  }
  if (lastKey) sections[lastKey] = clean.slice(lastIdx).trim();

  // KEY FACTORS: split on newlines and strip bullet prefixes (-, •, *, ·)
  const kfRaw = sections['KEY FACTORS'] ?? '';
  const keyFactors = kfRaw
    .split('\n')
    .map((l) => l.replace(/^[\s\-•*·]+/, '').trim())
    .filter(Boolean);

  // CONFIDENCE: extract the first integer found
  const confRaw = sections['CONFIDENCE'] ?? '';
  const confNum = parseInt(confRaw.match(/\d+/)?.[0] ?? '', 10);

  return {
    assessment:     sections['ASSESSMENT']       ?? '',
    keyFactors,
    optionsAnalysis: sections['OPTIONS ANALYSIS'] ?? '',
    recommendation: sections['RECOMMENDATION']   ?? '',
    confidence:     isNaN(confNum) ? null : confNum,
  };
}

// ── Shared section-header style ───────────────────────────────────────────────

const headerStyle = {
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  marginBottom: 8,
};

// ── Structured display ────────────────────────────────────────────────────────

function ReasoningDisplay({ parsed, isStreaming }: { parsed: ParsedReasoning; isStreaming: boolean }) {
  const hasContent =
    parsed.assessment ||
    parsed.keyFactors.length > 0 ||
    parsed.optionsAnalysis ||
    parsed.recommendation;

  if (!hasContent) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ASSESSMENT */}
      {parsed.assessment && (
        <section>
          <div style={{ ...headerStyle, color: 'var(--text-tertiary)' }}>Assessment</div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--text-primary)' }}>
            {parsed.assessment}
          </p>
        </section>
      )}

      {/* KEY FACTORS */}
      {parsed.keyFactors.length > 0 && (
        <section>
          <div style={{ ...headerStyle, color: 'var(--text-tertiary)' }}>Key Factors</div>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {parsed.keyFactors.map((factor, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--accent-cyan)', flexShrink: 0, lineHeight: 1.6, fontWeight: 700 }}>
                  •
                </span>
                <span style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                  {factor}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* OPTIONS ANALYSIS */}
      {parsed.optionsAnalysis && (
        <section>
          <div style={{ ...headerStyle, color: 'var(--text-tertiary)' }}>Options Analysis</div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
            {parsed.optionsAnalysis}
          </p>
        </section>
      )}

      {/* RECOMMENDATION — callout card */}
      {parsed.recommendation && (
        <section style={{
          background:   'rgba(0, 212, 255, 0.06)',
          border:       '1px solid rgba(0, 212, 255, 0.3)',
          borderLeft:   '4px solid var(--accent-cyan)',
          borderRadius: '0 4px 4px 0',
          padding:      12,
        }}>
          <div style={{ ...headerStyle, color: 'var(--accent-cyan)' }}>Recommendation</div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--text-primary)' }}>
            {parsed.recommendation}
          </p>
        </section>
      )}

      {/* Streaming cursor — lives inside display so it trails the last section */}
      {isStreaming && (
        <span
          className="inline-block w-0.5 h-4 animate-pulse"
          style={{ background: 'var(--accent-violet)', verticalAlign: 'middle' }}
        />
      )}
    </div>
  );
}

// ── Confidence meter ──────────────────────────────────────────────────────────

function ConfidenceMeter({ confidence }: { confidence: number }) {
  const color =
    confidence >= 80 ? 'var(--accent-green)'
    : confidence >= 60 ? 'var(--accent-amber)'
    : 'var(--accent-red)';
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
      <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>CONFIDENCE</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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

  const cdmId    = conjunction.cdmId;
  const state    = agentState[cdmId]    || 'IDLE';
  const reasoning = agentReasoning[cdmId] || '';
  const rec      = recommendations[cdmId];
  const endRef   = useRef<HTMLDivElement>(null);

  // Parse once per render — single source of truth for both the meter and the display.
  // This eliminates the mismatch where rec.confidence (derived in agent.ts via separate
  // code paths) could differ from the CONFIDENCE number actually in the rendered text.
  const parsed = useMemo(() => parseReasoningText(reasoning), [reasoning]);
  const meterConfidence = parsed.confidence ?? rec?.confidence ?? null;

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
      (r)     => completeAgentReasoning(cdmId, r),
      ()      => failAgentReasoning(cdmId),
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
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
                    style={{ background: 'var(--accent-violet)', animation: `pulse 1.2s ${i * 0.2}s infinite` }}
                  />
                ))}
              </div>
            )}
            {state === 'DONE'  && <CheckCircle2 size={12} style={{ color: 'var(--accent-green)' }} />}
            {state === 'ERROR' && <AlertCircle  size={12} style={{ color: 'var(--accent-amber)' }} />}
          </div>
          {meterConfidence !== null && <ConfidenceMeter confidence={meterConfidence} />}
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
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
            <ReasoningDisplay parsed={parsed} isStreaming={state === 'STREAMING'} />
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

      {/* ── Re-invoke footer ───────────────────────────────────────────────── */}
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
