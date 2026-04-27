// Simplified maneuver simulation for demo purposes
// Uses vis-viva equation approximations for plausibility

export function simulateManeuver(
  currentAlt: number,    // km
  deltaVMs: number,      // m/s (prograde)
  currentPc: number,
  currentMiss: number,
  tcaHoursAway: number
): { newMissDistanceM: number; newPc: number } {
  // Simplified: prograde Δv raises apogee, changes orbital period
  // Miss distance scales roughly linearly with Δv * time-to-TCA
  const amplification = tcaHoursAway * 3600 * 0.12; // rough geometric factor
  const missIncrease = deltaVMs * amplification;
  const newMiss = currentMiss + missIncrease;

  // P_c scales with miss^-2 roughly (1/sigma^2 in conjunction plane)
  const pcScale = Math.pow(currentMiss / newMiss, 2);
  const newPc = currentPc * pcScale * 0.8; // 0.8 accounts for covariance reduction

  return {
    newMissDistanceM: Math.round(newMiss),
    newPc: Math.max(1e-9, newPc),
  };
}

export function fuelCostFromDeltaV(
  deltaVMs: number,
  dryMassKg: number = 120,
  ispS: number = 220
): number {
  // Tsiolkovsky rocket equation
  const ve = ispS * 9.80665;
  const massRatio = Math.exp(deltaVMs / ve);
  return dryMassKg * (massRatio - 1);
}

export function missionLifeFromFuel(
  fuelUsedKg: number,
  totalFuelKg: number,
  totalMissionDays: number = 1825 // 5 years
): number {
  return (fuelUsedKg / totalFuelKg) * totalMissionDays;
}
