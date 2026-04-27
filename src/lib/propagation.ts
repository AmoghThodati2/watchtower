import * as satellite from 'satellite.js';
import * as Cesium from 'cesium';

export type EciPosition = { x: number; y: number; z: number };
export type GeoPosition = { lat: number; lon: number; alt: number };
export type CartesianPosition = { x: number; y: number; z: number };

export function parseTLE(line1: string, line2: string): satellite.SatRec | null {
  try {
    return satellite.twoline2satrec(line1, line2);
  } catch {
    return null;
  }
}

export function propagate(satrec: satellite.SatRec, date: Date): EciPosition | null {
  const result = satellite.propagate(satrec, date);
  if (!result.position || typeof result.position === 'boolean') return null;
  const pos = result.position as satellite.EciVec3<number>;
  return { x: pos.x, y: pos.y, z: pos.z };
}

export function eciToGeodetic(eci: EciPosition, date: Date): GeoPosition | null {
  try {
    const gmst = satellite.gstime(date);
    const geo = satellite.eciToGeodetic(
      { x: eci.x, y: eci.y, z: eci.z },
      gmst
    );
    return {
      lat: (geo.latitude * 180) / Math.PI,
      lon: (geo.longitude * 180) / Math.PI,
      alt: geo.height * 1000,
    };
  } catch {
    return null;
  }
}

export function eciToCartesian3(eci: EciPosition): Cesium.Cartesian3 {
  // ECI is in km, Cesium uses meters
  return new Cesium.Cartesian3(eci.x * 1000, eci.y * 1000, eci.z * 1000);
}

export function propagateToCartesian(
  satrec: satellite.SatRec,
  date: Date
): Cesium.Cartesian3 | null {
  const eci = propagate(satrec, date);
  if (!eci) return null;
  // Convert ECI → ECEF by rotating by GMST
  const gmst = satellite.gstime(date);
  const ecef = satellite.eciToEcf(eci, gmst);
  return new Cesium.Cartesian3(ecef.x * 1000, ecef.y * 1000, ecef.z * 1000);
}

export function getOrbitTrail(
  satrec: satellite.SatRec,
  date: Date,
  durationMinutes: number = 30,
  stepSeconds: number = 30
): Cesium.Cartesian3[] {
  const points: Cesium.Cartesian3[] = [];
  const steps = Math.floor((durationMinutes * 60) / stepSeconds);
  const startMs = date.getTime() - durationMinutes * 60 * 1000;

  for (let i = 0; i <= steps; i++) {
    const t = new Date(startMs + i * stepSeconds * 1000);
    const pos = propagateToCartesian(satrec, t);
    if (pos) points.push(pos);
  }

  return points;
}

export function getFutureTrajectory(
  satrec: satellite.SatRec,
  fromDate: Date,
  toDate: Date,
  stepSeconds: number = 60
): Cesium.Cartesian3[] {
  const points: Cesium.Cartesian3[] = [];
  const durationMs = toDate.getTime() - fromDate.getTime();
  const steps = Math.max(2, Math.floor(durationMs / 1000 / stepSeconds));

  for (let i = 0; i <= steps; i++) {
    const t = new Date(fromDate.getTime() + (durationMs * i) / steps);
    const pos = propagateToCartesian(satrec, t);
    if (pos) points.push(pos);
  }

  return points;
}

export function getAltitudeKm(satrec: satellite.SatRec, date: Date): number | null {
  const eci = propagate(satrec, date);
  if (!eci) return null;
  const r = Math.sqrt(eci.x ** 2 + eci.y ** 2 + eci.z ** 2);
  return r - 6371; // subtract Earth radius in km
}
