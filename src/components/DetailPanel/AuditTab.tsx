import { AuditEntry } from '../../ontology/types';
import { format } from 'date-fns';
import { Terminal, Bot, User, Server, CheckCircle2, type LucideIcon } from 'lucide-react';

type Props = { entries: AuditEntry[] };

const ACTOR_CONFIG: Record<string, { icon: LucideIcon; color: string; label: string }> = {
  SYSTEM: { icon: Server, color: 'var(--text-tertiary)', label: 'SYSTEM' },
  AGENT: { icon: Bot, color: 'var(--accent-violet)', label: 'AGENT' },
  OPERATOR: { icon: User, color: 'var(--accent-cyan)', label: 'OPERATOR' },
};

const EVENT_ICONS: Record<string, LucideIcon> = {
  CDM_RECEIVED: Terminal,
  AUTO_TRIAGE: Server,
  OPERATOR_VIEWED: User,
  AGENT_INVOKED: Bot,
  OPTIONS_GENERATED: Bot,
  AGENT_COMPLETE: Bot,
  MANEUVER_EXECUTED: CheckCircle2,
  COMMAND_GENERATED: Terminal,
  GROUND_ROUTING: Server,
  STATUS_MITIGATED: CheckCircle2,
};

export function AuditTab({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No audit entries yet</p>
      </div>
    );
  }

  return (
    <div className="p-4 overflow-y-auto h-full">
      <div className="text-xs font-semibold tracking-wider mb-4" style={{ color: 'var(--text-tertiary)' }}>
        AUDIT TRAIL
      </div>
      <div className="relative">
        {/* Vertical line */}
        <div
          className="absolute left-4 top-0 bottom-0 w-px"
          style={{ background: 'var(--border-subtle)' }}
        />

        <div className="space-y-4">
          {entries.map((entry, i) => {
            const actor = ACTOR_CONFIG[entry.actor];
            const ActorIcon = actor.icon;
            const EventIcon = EVENT_ICONS[entry.event] || Terminal;
            const isLast = i === entries.length - 1;

            return (
              <div key={entry.id} className="flex gap-4 pl-1">
                {/* Icon on the timeline */}
                <div
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center z-10"
                  style={{
                    background: 'var(--bg-panel)',
                    border: `1px solid ${actor.color}40`,
                  }}
                >
                  <ActorIcon size={12} style={{ color: actor.color }} />
                </div>

                {/* Content */}
                <div className="flex-1 pb-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {entry.event.replace(/_/g, ' ')}
                    </span>
                    <span className="font-mono text-xs tabular" style={{ color: 'var(--text-tertiary)' }}>
                      {format(new Date(entry.timestamp), 'HH:mm:ss')} UTC
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {entry.detail}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        background: `${actor.color}15`,
                        color: actor.color,
                        fontSize: 10,
                      }}
                    >
                      {actor.label}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
