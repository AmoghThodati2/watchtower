import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../../state/store';
import { OverviewTab } from './OverviewTab';
import { ManeuverOptionsTab } from './ManeuverOptionsTab';
import { AgentReasoningTab } from './AgentReasoningTab';
import { AuditTab } from './AuditTab';
import { X, Satellite, Brain, Zap, ClipboardList } from 'lucide-react';
import { cn } from '../../lib/utils';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Satellite },
  { id: 'maneuver', label: 'Maneuver', icon: Zap },
  { id: 'reasoning', label: 'Agent', icon: Brain },
  { id: 'audit', label: 'Audit', icon: ClipboardList },
];

export function DetailPanel() {
  const {
    conjunctions,
    selectedCdmId,
    activeTab,
    maneuverOptions,
    recommendations,
    auditLog,
    setActiveTab,
    selectConjunction,
  } = useStore();

  const conjunction = conjunctions.find((c) => c.cdmId === selectedCdmId);

  return (
    <AnimatePresence>
      {conjunction && (
        <motion.div
          key={selectedCdmId}
          initial={{ x: 30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 30, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col h-full"
          style={{
            width: 480,
            background: 'var(--bg-panel)',
            borderLeft: '1px solid var(--border-subtle)',
            position: 'relative',
            zIndex: 10,
          }}
        >
          {/* Panel header */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {conjunction.primary.name}
                </span>
                <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>↔</span>
                <span className="text-sm" style={{ color: 'var(--accent-red)' }}>
                  {'name' in conjunction.secondary ? conjunction.secondary.name : 'DEBRIS'}
                </span>
              </div>
              <div className="font-mono text-xs tabular mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                {conjunction.cdmId}
              </div>
            </div>
            <button
              onClick={() => selectConjunction(null)}
              className="p-1.5 rounded transition-colors"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <X size={16} />
            </button>
          </div>

          {/* Tabs */}
          <div
            className="flex shrink-0"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors relative"
                  style={{
                    color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    background: isActive ? 'var(--bg-elevated)' : 'transparent',
                    borderBottom: isActive ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                  }}
                >
                  <Icon size={12} />
                  {tab.label}
                  {tab.id === 'reasoning' && (
                    <span
                      className="ml-1 px-1 py-0.5 rounded text-xs"
                      style={{
                        background: 'rgba(167, 139, 250, 0.15)',
                        color: 'var(--accent-violet)',
                        fontSize: 9,
                      }}
                    >
                      AI
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="h-full"
              >
                {activeTab === 'overview' && <OverviewTab conjunction={conjunction} />}
                {activeTab === 'maneuver' && (
                  <ManeuverOptionsTab
                    options={maneuverOptions[conjunction.cdmId] || []}
                    recommendation={recommendations[conjunction.cdmId]}
                    conjunctionId={conjunction.cdmId}
                  />
                )}
                {activeTab === 'reasoning' && (
                  <AgentReasoningTab
                    conjunction={conjunction}
                    options={maneuverOptions[conjunction.cdmId] || []}
                  />
                )}
                {activeTab === 'audit' && (
                  <AuditTab entries={auditLog[conjunction.cdmId] || []} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
