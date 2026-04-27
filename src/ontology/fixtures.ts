import { Satellite, DebrisObject, Conjunction, ManeuverOption } from './types';
import { addHours, subDays, formatISO } from 'date-fns';

const NOW = new Date();

// Arclight Imaging fleet — 24 sun-synchronous LEO satellites at ~550km
// TLEs generated for SSO at 550km, RAAN spread evenly across the fleet
function makeArcTLE(id: number): { line1: string; line2: string } {
  // Sun-synchronous orbit: inc ~97.6°, alt 550km
  // We spread RAAN evenly across 24 sats (15° apart)
  const raan = ((id - 1) * 15) % 360;
  const raanStr = raan.toFixed(4).padStart(8, ' ');
  const epoch = '25117.50000000';
  const noradId = 70000 + id;
  const noradStr = String(noradId);

  const line1 = `1 ${noradStr}U 25001${String.fromCharCode(64 + id)}   ${epoch}  .00000100  00000-0  13000-4 0  999${(id % 10)}`;
  const inc = 97.6 + (id % 3) * 0.01;
  const ma = ((id * 37 + 13) % 360).toFixed(4);
  const argPerigee = ((id * 53 + 7) % 360).toFixed(4);
  const ecc = '0001234';
  const rMM = 15.2437;
  const line2 = `2 ${noradStr}  ${inc.toFixed(4)} ${raanStr} ${ecc} ${argPerigee.padStart(8,' ')} ${ma.padStart(8,' ')}${rMM.toFixed(8)} ${String(10000 + id)}`;

  return { line1, line2 };
}

const MISSIONS = [
  'EO imaging — agricultural monitoring',
  'EO imaging — maritime surveillance',
  'EO imaging — urban change detection',
  'EO imaging — wildfire monitoring',
  'EO imaging — infrastructure inspection',
  'EO imaging — flood mapping',
  'EO imaging — deforestation tracking',
  'EO imaging — crop yield estimation',
];

export const ARCLIGHT_FLEET: Satellite[] = Array.from({ length: 24 }, (_, i) => {
  const id = i + 1;
  const seed = id * 7919;
  const fuel = 5 + (seed % 36);
  const tiers: ('TIER_1' | 'TIER_2' | 'TIER_3')[] = ['TIER_1', 'TIER_2', 'TIER_3'];
  const criticality = id <= 8 ? 'TIER_1' : id <= 16 ? 'TIER_2' : 'TIER_3';

  return {
    noradId: 70000 + id,
    name: `ARC-${String(id).padStart(2, '0')}`,
    operator: 'Arclight Imaging',
    isOwned: true,
    tle: makeArcTLE(id),
    launchDate: formatISO(subDays(NOW, 200 + id * 30)),
    missionCriticality: criticality,
    fuelRemainingKg: fuel,
    totalDeltaVRemaining: fuel * 22,
    priorManeuverCount: Math.floor((seed % 5)),
    mission: MISSIONS[(id - 1) % MISSIONS.length],
  };
});

// Hero satellite: ARC-07 — SSO 550km, TIER_1
export const ARC07: Satellite = {
  noradId: 70007,
  name: 'ARC-07',
  operator: 'Arclight Imaging',
  isOwned: true,
  tle: {
    line1: '1 70007U 25001G   25117.50000000  .00000100  00000-0  13000-4 0  9997',
    line2: '2 70007  97.6000  90.0000 0001234 260.0000 100.0000 15.24370000 10007',
  },
  launchDate: formatISO(subDays(NOW, 410)),
  missionCriticality: 'TIER_1',
  fuelRemainingKg: 8.2,
  totalDeltaVRemaining: 180,
  priorManeuverCount: 2,
  mission: 'EO imaging — agricultural monitoring',
};

// Update ARC07 in fleet
ARCLIGHT_FLEET[6] = ARC07;

// Iridium-33 debris piece (from 2009 collision)
export const IRIDIUM33_DEBRIS: DebrisObject = {
  noradId: 33778,
  name: 'IRIDIUM 33 DEB',
  parentEvent: 'Iridium-Cosmos 2009',
  tle: {
    line1: '1 33778U 93036PBN 25117.52000000  .00000800  00000-0  15000-3 0  9991',
    line2: '2 33778  86.3900 270.4000 0012000 180.0000 180.0000 14.37200000 11234',
  },
  estimatedSizeM: 0.3,
};

// The hero conjunction — ARC-07 vs Iridium-33 debris, 47h from now
export const HERO_CONJUNCTION: Conjunction = {
  cdmId: 'CDM-2025-11-04-0014',
  primary: ARC07,
  secondary: IRIDIUM33_DEBRIS,
  tca: formatISO(addHours(NOW, 47)),
  missDistanceM: 280,
  probabilityOfCollision: 1.4e-3,
  relativeVelocityKmS: 13.2,
  status: 'NEW',
  receivedAt: formatISO(subDays(NOW, 0)),
};

// Hero maneuver options
export const HERO_MANEUVER_OPTIONS: ManeuverOption[] = [
  {
    id: 'OPT-A',
    label: 'A',
    conjunctionId: 'CDM-2025-11-04-0014',
    burnTime: formatISO(addHours(NOW, 24)),
    deltaVMs: 0.42,
    fuelCostKg: 0.26,
    missionLifeImpactDays: 8,
    newMissDistanceM: 2100,
    newPc: 2.1e-6,
    groundTrackImpact: 'Loses 6 imaging passes over Brazil & SE Asia agricultural zones',
    riskLevel: 'LOW',
  },
  {
    id: 'OPT-B',
    label: 'B',
    conjunctionId: 'CDM-2025-11-04-0014',
    burnTime: formatISO(addHours(NOW, 36)),
    deltaVMs: 0.21,
    fuelCostKg: 0.13,
    missionLifeImpactDays: 4,
    newMissDistanceM: 1450,
    newPc: 8.3e-6,
    groundTrackImpact: 'Loses 2 imaging passes over Brazil agricultural zones',
    riskLevel: 'LOW',
  },
  {
    id: 'OPT-C',
    label: 'C',
    conjunctionId: 'CDM-2025-11-04-0014',
    burnTime: formatISO(addHours(NOW, 44)),
    deltaVMs: 0.08,
    fuelCostKg: 0.05,
    missionLifeImpactDays: 1.5,
    newMissDistanceM: 620,
    newPc: 3.1e-4,
    groundTrackImpact: 'Minimal: 1 imaging pass rescheduled by 18 minutes',
    riskLevel: 'MEDIUM',
  },
];
