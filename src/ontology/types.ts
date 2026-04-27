export type MissionCriticality = 'TIER_1' | 'TIER_2' | 'TIER_3';
export type ConjunctionStatus = 'NEW' | 'TRIAGED' | 'MITIGATED' | 'ACCEPTED';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type ActionType = 'EXECUTE_MANEUVER' | 'ACCEPT_RISK' | 'ESCALATE' | 'REQUEST_REVIEW';

export type Satellite = {
  noradId: number;
  name: string;
  operator: string;
  isOwned: boolean;
  tle: { line1: string; line2: string };
  launchDate: string;
  missionCriticality: MissionCriticality;
  fuelRemainingKg?: number;
  totalDeltaVRemaining?: number;
  priorManeuverCount: number;
  mission?: string;
};

export type DebrisObject = {
  noradId: number;
  name: string;
  parentEvent: string;
  tle: { line1: string; line2: string };
  estimatedSizeM: number;
};

export type Conjunction = {
  cdmId: string;
  primary: Satellite;
  secondary: Satellite | DebrisObject;
  tca: string;
  missDistanceM: number;
  probabilityOfCollision: number;
  relativeVelocityKmS: number;
  status: ConjunctionStatus;
  receivedAt: string;
};

export type ManeuverOption = {
  id: string;
  label: 'A' | 'B' | 'C';
  conjunctionId: string;
  burnTime: string;
  deltaVMs: number;
  fuelCostKg: number;
  missionLifeImpactDays: number;
  newMissDistanceM: number;
  newPc: number;
  groundTrackImpact: string;
  riskLevel: RiskLevel;
};

export type AgentRecommendation = {
  conjunctionId: string;
  recommendedOptionId: string;
  reasoning: string;
  citedFactors: string[];
  confidence: number;
  generatedAt: string;
};

export type AuditEntry = {
  id: string;
  conjunctionId: string;
  timestamp: string;
  event: string;
  detail: string;
  actor: 'SYSTEM' | 'AGENT' | 'OPERATOR';
};

export type ExecutedAction = {
  id: string;
  conjunctionId: string;
  actionType: ActionType;
  executedBy: string;
  timestamp: string;
  notes: string;
};

export function isDebrisObject(obj: Satellite | DebrisObject): obj is DebrisObject {
  return 'parentEvent' in obj;
}
