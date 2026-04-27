import { create } from 'zustand';
import {
  Conjunction,
  ManeuverOption,
  AgentRecommendation,
  AuditEntry,
  ExecutedAction,
  ConjunctionStatus,
} from '../ontology/types';
import { Satellite } from '../ontology/types';
import { ARCLIGHT_FLEET } from '../ontology/fixtures';
import { formatISO } from 'date-fns';

export type SortKey = 'TCA' | 'PC' | 'MISS';
export type AgentState = 'IDLE' | 'STREAMING' | 'DONE' | 'ERROR';

let auditSeq = 1;
function makeAudit(cdmId: string, event: string, detail: string, actor: 'SYSTEM' | 'AGENT' | 'OPERATOR' = 'SYSTEM'): AuditEntry {
  return {
    id: `AUDIT-${String(auditSeq++).padStart(6, '0')}`,
    conjunctionId: cdmId,
    timestamp: formatISO(new Date()),
    event,
    detail,
    actor,
  };
}

interface WatchtowerState {
  // Fleet
  fleet: Satellite[];

  // CDM queue
  conjunctions: Conjunction[];
  selectedCdmId: string | null;

  // Maneuver options
  maneuverOptions: Record<string, ManeuverOption[]>;

  // Agent
  agentState: Record<string, AgentState>;
  agentReasoning: Record<string, string>;
  recommendations: Record<string, AgentRecommendation>;

  // Audit
  auditLog: Record<string, AuditEntry[]>;

  // Executed actions
  executedActions: ExecutedAction[];

  // UI state
  sortKey: SortKey;
  filterOwned: boolean;
  activeTab: string;
  showExecuteOverlay: boolean;
  executingOption: ManeuverOption | null;
  showPostExecuteTrajectory: Record<string, boolean>;

  // Actions
  setConjunctions: (conjunctions: Conjunction[], options: ManeuverOption[]) => void;
  selectConjunction: (cdmId: string | null) => void;
  setSortKey: (key: SortKey) => void;
  setFilterOwned: (v: boolean) => void;
  setActiveTab: (tab: string) => void;

  startAgentStream: (cdmId: string) => void;
  appendAgentReasoning: (cdmId: string, chunk: string) => void;
  completeAgentReasoning: (cdmId: string, rec: AgentRecommendation) => void;
  failAgentReasoning: (cdmId: string) => void;

  openExecuteOverlay: (option: ManeuverOption) => void;
  closeExecuteOverlay: () => void;
  executeManeuver: (option: ManeuverOption, conjunctionId: string) => void;

  addAuditEntry: (entry: AuditEntry) => void;
  updateConjunctionStatus: (cdmId: string, status: ConjunctionStatus) => void;
}

export const useStore = create<WatchtowerState>((set, get) => ({
  fleet: ARCLIGHT_FLEET,
  conjunctions: [],
  selectedCdmId: null,
  maneuverOptions: {},
  agentState: {},
  agentReasoning: {},
  recommendations: {},
  auditLog: {},
  executedActions: [],
  sortKey: 'PC',
  filterOwned: true,
  activeTab: 'overview',
  showExecuteOverlay: false,
  executingOption: null,
  showPostExecuteTrajectory: {},

  setConjunctions: (conjunctions, options) => {
    const optMap: Record<string, ManeuverOption[]> = {};
    const auditMap: Record<string, AuditEntry[]> = {};

    options.forEach((o) => {
      if (!optMap[o.conjunctionId]) optMap[o.conjunctionId] = [];
      optMap[o.conjunctionId].push(o);
    });

    conjunctions.forEach((c) => {
      auditMap[c.cdmId] = [
        makeAudit(c.cdmId, 'CDM_RECEIVED', `CDM ${c.cdmId} ingested from Space-Track feed`, 'SYSTEM'),
        makeAudit(c.cdmId, 'AUTO_TRIAGE', `Automated triage: P_c ${c.probabilityOfCollision.toExponential(2)} — routed to operator queue`, 'SYSTEM'),
      ];
    });

    set({ conjunctions, maneuverOptions: optMap, auditLog: auditMap });
  },

  selectConjunction: (cdmId) => {
    const { auditLog, conjunctions } = get();
    const conj = conjunctions.find((c) => c.cdmId === cdmId);

    if (cdmId && conj && conj.status === 'NEW') {
      const newLog = { ...auditLog };
      if (!newLog[cdmId]) newLog[cdmId] = [];
      newLog[cdmId] = [...newLog[cdmId], makeAudit(cdmId, 'OPERATOR_VIEWED', 'Conjunction opened by Marcus Chen', 'OPERATOR')];

      const newConjs = conjunctions.map((c) =>
        c.cdmId === cdmId ? { ...c, status: 'TRIAGED' as ConjunctionStatus } : c
      );

      set({ selectedCdmId: cdmId, activeTab: 'overview', auditLog: newLog, conjunctions: newConjs });
    } else {
      set({ selectedCdmId: cdmId, activeTab: 'overview' });
    }
  },

  setSortKey: (sortKey) => set({ sortKey }),
  setFilterOwned: (filterOwned) => set({ filterOwned }),
  setActiveTab: (activeTab) => set({ activeTab }),

  startAgentStream: (cdmId) => {
    const { auditLog } = get();
    const newLog = { ...auditLog };
    if (!newLog[cdmId]) newLog[cdmId] = [];
    newLog[cdmId] = [...newLog[cdmId], makeAudit(cdmId, 'AGENT_INVOKED', 'Spaceflight Safety AI agent started reasoning', 'AGENT')];

    set((s) => ({
      agentState: { ...s.agentState, [cdmId]: 'STREAMING' },
      agentReasoning: { ...s.agentReasoning, [cdmId]: '' },
      auditLog: newLog,
    }));
  },

  appendAgentReasoning: (cdmId, chunk) => {
    set((s) => ({
      agentReasoning: { ...s.agentReasoning, [cdmId]: (s.agentReasoning[cdmId] || '') + chunk },
    }));
  },

  completeAgentReasoning: (cdmId, rec) => {
    const { auditLog } = get();
    const newLog = { ...auditLog };
    if (!newLog[cdmId]) newLog[cdmId] = [];
    newLog[cdmId] = [...newLog[cdmId],
      makeAudit(cdmId, 'OPTIONS_GENERATED', `3 maneuver options generated; Option ${rec.recommendedOptionId.split('-').pop()} recommended`, 'AGENT'),
      makeAudit(cdmId, 'AGENT_COMPLETE', `Reasoning complete. Confidence: ${rec.confidence}%`, 'AGENT'),
    ];

    set((s) => ({
      agentState: { ...s.agentState, [cdmId]: 'DONE' },
      recommendations: { ...s.recommendations, [cdmId]: rec },
      auditLog: newLog,
    }));
  },

  failAgentReasoning: (cdmId) => {
    set((s) => ({ agentState: { ...s.agentState, [cdmId]: 'ERROR' } }));
  },

  openExecuteOverlay: (option) => set({ showExecuteOverlay: true, executingOption: option }),
  closeExecuteOverlay: () => set({ showExecuteOverlay: false, executingOption: null }),

  executeManeuver: (option, conjunctionId) => {
    const { auditLog, conjunctions } = get();
    const newLog = { ...auditLog };
    if (!newLog[conjunctionId]) newLog[conjunctionId] = [];
    newLog[conjunctionId] = [...newLog[conjunctionId],
      makeAudit(conjunctionId, 'MANEUVER_EXECUTED', `Option ${option.label} approved and queued for execution`, 'OPERATOR'),
      makeAudit(conjunctionId, 'COMMAND_GENERATED', `Δv vector: [+${option.deltaVMs.toFixed(2)}, -${(option.deltaVMs * 0.85).toFixed(2)}, +${(option.deltaVMs * 0.18).toFixed(2)}] m/s`, 'SYSTEM'),
      makeAudit(conjunctionId, 'GROUND_ROUTING', 'Command routed to Arclight TT&C: Svalbard station acknowledged', 'SYSTEM'),
      makeAudit(conjunctionId, 'STATUS_MITIGATED', `CDM ${conjunctionId} status → MITIGATED`, 'SYSTEM'),
    ];

    const newConjs = conjunctions.map((c) =>
      c.cdmId === conjunctionId ? { ...c, status: 'MITIGATED' as ConjunctionStatus } : c
    );

    const action: ExecutedAction = {
      id: `ACT-${Date.now()}`,
      conjunctionId,
      actionType: 'EXECUTE_MANEUVER',
      executedBy: 'Marcus Chen',
      timestamp: formatISO(new Date()),
      notes: `Option ${option.label}: ${option.deltaVMs} m/s Δv, burn at ${option.burnTime}`,
    };

    set((s) => ({
      auditLog: newLog,
      conjunctions: newConjs,
      executedActions: [...s.executedActions, action],
      showExecuteOverlay: false,
      executingOption: null,
      showPostExecuteTrajectory: { ...s.showPostExecuteTrajectory, [conjunctionId]: true },
    }));
  },

  addAuditEntry: (entry) => {
    set((s) => ({
      auditLog: {
        ...s.auditLog,
        [entry.conjunctionId]: [...(s.auditLog[entry.conjunctionId] || []), entry],
      },
    }));
  },

  updateConjunctionStatus: (cdmId, status) => {
    set((s) => ({
      conjunctions: s.conjunctions.map((c) => (c.cdmId === cdmId ? { ...c, status } : c)),
    }));
  },
}));
