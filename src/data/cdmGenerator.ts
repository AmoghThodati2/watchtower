import { addHours, formatISO, subMinutes } from 'date-fns';
import { Conjunction, Satellite, DebrisObject, ManeuverOption } from '../ontology/types';
import { ARCLIGHT_FLEET, HERO_CONJUNCTION, HERO_MANEUVER_OPTIONS } from '../ontology/fixtures';
import { TLEEntry } from './celestrak';

const NOW = new Date();

function rnd(min: number, max: number, seed?: number): number {
  const s = seed !== undefined ? seed : Math.random();
  return min + s * (max - min);
}

function seededRnd(seed: number, min: number, max: number): number {
  const x = Math.sin(seed) * 10000;
  const r = x - Math.floor(x);
  return min + r * (max - min);
}

function makeDebrisFromTLE(tle: TLEEntry, parentEvent: string): DebrisObject {
  const norad = parseInt(tle.line1.slice(2, 7).trim());
  return {
    noradId: norad,
    name: tle.name.trim(),
    parentEvent,
    tle: { line1: tle.line1, line2: tle.line2 },
    estimatedSizeM: seededRnd(norad, 0.05, 0.8),
  };
}

function makeForeignSat(tle: TLEEntry, operator: string): Satellite {
  const norad = parseInt(tle.line1.slice(2, 7).trim());
  return {
    noradId: norad,
    name: tle.name.trim(),
    operator,
    isOwned: false,
    tle: { line1: tle.line1, line2: tle.line2 },
    launchDate: formatISO(subMinutes(NOW, seededRnd(norad, 100000, 500000))),
    missionCriticality: 'TIER_3',
    priorManeuverCount: 0,
  };
}

function generateManeuverOptions(cdmId: string, missDistance: number, pc: number): ManeuverOption[] {
  return [
    {
      id: `${cdmId}-A`,
      label: 'A',
      conjunctionId: cdmId,
      burnTime: formatISO(addHours(NOW, 12)),
      deltaVMs: rnd(0.35, 0.55, 0.42),
      fuelCostKg: rnd(0.18, 0.32, 0.25),
      missionLifeImpactDays: rnd(6, 10, 8),
      newMissDistanceM: missDistance * 7.2,
      newPc: pc * 0.001,
      groundTrackImpact: 'Loses 5 imaging passes over priority agricultural targets',
      riskLevel: 'LOW',
    },
    {
      id: `${cdmId}-B`,
      label: 'B',
      conjunctionId: cdmId,
      burnTime: formatISO(addHours(NOW, 24)),
      deltaVMs: rnd(0.18, 0.28, 0.22),
      fuelCostKg: rnd(0.09, 0.16, 0.12),
      missionLifeImpactDays: rnd(3, 5, 4),
      newMissDistanceM: missDistance * 4.1,
      newPc: pc * 0.008,
      groundTrackImpact: 'Loses 2 imaging passes, recovers within 48h',
      riskLevel: 'LOW',
    },
    {
      id: `${cdmId}-C`,
      label: 'C',
      conjunctionId: cdmId,
      burnTime: formatISO(addHours(NOW, 42)),
      deltaVMs: rnd(0.05, 0.12, 0.07),
      fuelCostKg: rnd(0.03, 0.07, 0.04),
      missionLifeImpactDays: rnd(0.5, 2, 1),
      newMissDistanceM: missDistance * 2.0,
      newPc: pc * 0.15,
      groundTrackImpact: 'Minimal schedule impact, 1 pass rescheduled by 22 minutes',
      riskLevel: 'MEDIUM',
    },
  ];
}

export function generateCDMQueue(
  iridiumDebris: TLEEntry[],
  cosmos2251Debris: TLEEntry[],
  starlink: TLEEntry[]
): { conjunctions: Conjunction[]; maneuverOptions: ManeuverOption[] } {
  const conjunctions: Conjunction[] = [HERO_CONJUNCTION];
  const maneuverOptions: ManeuverOption[] = [...HERO_MANEUVER_OPTIONS];

  const debrisSources: Array<{ tle: TLEEntry; event: string }> = [
    ...iridiumDebris.slice(5, 15).map((t) => ({ tle: t, event: 'Iridium-Cosmos 2009' })),
    ...cosmos2251Debris.slice(3, 12).map((t) => ({ tle: t, event: 'Cosmos 2251 Collision 2009' })),
  ];

  const starlinkSources = starlink.slice(10, 30);

  const scenarios = [
    { tca: 18, miss: 890, pc: 2.3e-5, vel: 7.1, debrisIdx: 0, arcIdx: 1 },
    { tca: 31, miss: 1200, pc: 8.7e-6, vel: 9.4, debrisIdx: 1, arcIdx: 3 },
    { tca: 52, miss: 430, pc: 1.1e-4, vel: 11.8, debrisIdx: 2, arcIdx: 5 },
    { tca: 67, miss: 2800, pc: 3.4e-7, vel: 6.2, starlinkIdx: 0, arcIdx: 8 },
    { tca: 83, miss: 640, pc: 5.6e-5, vel: 14.1, debrisIdx: 3, arcIdx: 11 },
    { tca: 91, miss: 3400, pc: 1.2e-7, vel: 8.9, starlinkIdx: 1, arcIdx: 15 },
    { tca: 29, miss: 180, pc: 2.8e-3, vel: 12.3, debrisIdx: 4, arcIdx: 2 },
  ];

  scenarios.forEach((sc, i) => {
    const cdmId = `CDM-2025-11-04-${String(i + 1).padStart(4, '0')}`;
    const primary = ARCLIGHT_FLEET[sc.arcIdx] || ARCLIGHT_FLEET[0];

    let secondary: Satellite | DebrisObject;
    const starlinkIdx = 'starlinkIdx' in sc ? (sc.starlinkIdx as number | undefined) : undefined;
    const debrisIdx = 'debrisIdx' in sc ? (sc.debrisIdx as number) : 0;
    if (starlinkIdx !== undefined && starlinkSources[starlinkIdx]) {
      secondary = makeForeignSat(starlinkSources[starlinkIdx], 'SpaceX');
    } else if (debrisSources[debrisIdx]) {
      secondary = makeDebrisFromTLE(debrisSources[debrisIdx].tle, debrisSources[debrisIdx].event);
    } else {
      secondary = makeDebrisFromTLE(debrisSources[0].tle, debrisSources[0].event);
    }

    const conj: Conjunction = {
      cdmId,
      primary,
      secondary,
      tca: formatISO(addHours(NOW, sc.tca)),
      missDistanceM: sc.miss,
      probabilityOfCollision: sc.pc,
      relativeVelocityKmS: sc.vel,
      status: 'NEW',
      receivedAt: formatISO(subMinutes(NOW, 30 + i * 15)),
    };

    conjunctions.push(conj);
    maneuverOptions.push(...generateManeuverOptions(cdmId, sc.miss, sc.pc));
  });

  // Sort: hero first, then by P_c descending
  conjunctions.sort((a, b) => {
    if (a.cdmId === HERO_CONJUNCTION.cdmId) return -1;
    if (b.cdmId === HERO_CONJUNCTION.cdmId) return 1;
    return b.probabilityOfCollision - a.probabilityOfCollision;
  });

  return { conjunctions, maneuverOptions };
}
