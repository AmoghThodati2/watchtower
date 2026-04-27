import { useEffect, useCallback } from 'react';
import { TopBar } from './components/TopBar';
import { CdmQueue } from './components/CdmQueue';
import { WatchtowerGlobe } from './components/Globe/WatchtowerGlobe';
import { DetailPanel } from './components/DetailPanel/DetailPanel';
import { ExecuteOverlay } from './components/ExecuteOverlay';
import { useStore } from './state/store';
import { fetchAllTLEs } from './data/celestrak';
import { generateCDMQueue } from './data/cdmGenerator';

export default function App() {
  const { setConjunctions, selectedCdmId, selectConjunction, conjunctions } = useStore();

  useEffect(() => {
    async function init() {
      const { iridium33Debris, cosmos2251Debris, starlink } = await fetchAllTLEs();
      const { conjunctions: cdms, maneuverOptions } = generateCDMQueue(
        iridium33Debris,
        cosmos2251Debris,
        starlink
      );
      setConjunctions(cdms, maneuverOptions);
    }
    init();
  }, [setConjunctions]);

  // Keyboard nav
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        selectConjunction(null);
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (conjunctions.length === 0) return;
        const idx = conjunctions.findIndex((c) => c.cdmId === selectedCdmId);
        if (e.key === 'ArrowDown') {
          const next = idx < conjunctions.length - 1 ? idx + 1 : 0;
          selectConjunction(conjunctions[next].cdmId);
        } else {
          const prev = idx > 0 ? idx - 1 : conjunctions.length - 1;
          selectConjunction(conjunctions[prev].cdmId);
        }
        e.preventDefault();
      }
    },
    [conjunctions, selectedCdmId, selectConjunction]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: 'var(--bg-void)', overflow: 'hidden' }}>
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Left rail — CDM Queue */}
        <div className="shrink-0 overflow-hidden" style={{ width: 320 }}>
          <CdmQueue />
        </div>

        {/* Globe — fills all remaining space between the two rails */}
        <div style={{ flex: '1 1 0', position: 'relative', overflow: 'hidden', minWidth: 0 }}>
          <WatchtowerGlobe />
        </div>

        {/* Right rail — Detail Panel */}
        <DetailPanel />
      </div>

      {/* Execute overlay (modal) */}
      <ExecuteOverlay />
    </div>
  );
}
