import Anthropic from '@anthropic-ai/sdk';
import { Conjunction, ManeuverOption, AgentRecommendation, isDebrisObject } from '../ontology/types';
import { CANNED_REASONING, CANNED_CITED_FACTORS, CANNED_CONFIDENCE } from '../data/cannedReasoning';
import { formatISO } from 'date-fns';

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;

const SYSTEM_PROMPT = `You are a Spaceflight Safety Officer assisting a satellite operations engineer at Arclight Imaging. You are reviewing a Conjunction Data Message and producing a recommendation. Your output must be structured, defensible, and operationally specific.

You will receive: the primary satellite (Arclight-owned), the secondary object (debris or another satellite), the CDM parameters (TCA, miss distance, P_c, relative velocity), the primary's mission criticality and remaining fuel, the primary's prior maneuver history, and 2-3 candidate maneuver options.

Produce reasoning in this exact format:

ASSESSMENT: One sentence stating the threat level and why.

KEY FACTORS:
- 4 to 6 bullet points, each citing a specific data point from the inputs.

OPTIONS ANALYSIS: For each maneuver option, 2-3 sentences on its tradeoffs.

RECOMMENDATION: State which option (A, B, or C) you recommend and the single decisive reason.

CONFIDENCE: A number from 0 to 100 reflecting how clear-cut this decision is.

Be terse. Operators are reading this under time pressure. Do not hedge unnecessarily. Do not recommend "consult further" unless the data is genuinely insufficient.`;

function buildUserPrompt(conjunction: Conjunction, options: ManeuverOption[]): string {
  const { primary, secondary, tca, missDistanceM, probabilityOfCollision, relativeVelocityKmS } = conjunction;
  const tcaDate = new Date(tca);
  const hoursToTCA = ((tcaDate.getTime() - Date.now()) / 3600000).toFixed(1);

  const secondaryDesc = isDebrisObject(secondary)
    ? `Debris object: ${secondary.name}, Parent event: ${secondary.parentEvent}, Estimated size: ${secondary.estimatedSizeM}m`
    : `Satellite: ${secondary.name}, Operator: ${secondary.operator}`;

  const optionsDesc = options.map((o) => `
Option ${o.label}:
  - Burn time: ${o.burnTime} (T-${Math.round((new Date(o.burnTime).getTime() - Date.now()) / 3600000)}h)
  - Delta-V: ${o.deltaVMs} m/s
  - Fuel cost: ${o.fuelCostKg} kg
  - Mission life impact: ${o.missionLifeImpactDays} days
  - New miss distance: ${o.newMissDistanceM}m
  - New P_c: ${o.newPc.toExponential(2)}
  - Ground track: ${o.groundTrackImpact}
  - Risk: ${o.riskLevel}`).join('\n');

  return `CDM ID: ${conjunction.cdmId}
Time to TCA: ${hoursToTCA} hours

PRIMARY SATELLITE:
  Name: ${primary.name}
  Mission: ${primary.mission || 'Earth observation'}
  Criticality: ${primary.missionCriticality}
  Fuel remaining: ${primary.fuelRemainingKg ?? 'unknown'} kg
  Total ΔV remaining: ${primary.totalDeltaVRemaining ?? 'unknown'} m/s
  Prior maneuvers: ${primary.priorManeuverCount}

SECONDARY OBJECT:
  ${secondaryDesc}

CDM PARAMETERS:
  Miss distance: ${missDistanceM}m
  P_c: ${probabilityOfCollision.toExponential(2)}
  Relative velocity: ${relativeVelocityKmS} km/s
  TCA: ${tca}

MANEUVER OPTIONS:
${optionsDesc}`;
}

export async function streamAgentReasoning(
  conjunction: Conjunction,
  options: ManeuverOption[],
  onChunk: (text: string) => void,
  onComplete: (recommendation: AgentRecommendation) => void,
  onError: (err: Error) => void
): Promise<void> {
  const canned = CANNED_REASONING[conjunction.cdmId];

  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY.length < 10) {
    // Simulate streaming with canned text
    if (canned) {
      await simulateStream(canned, onChunk);
      const confidence = CANNED_CONFIDENCE[conjunction.cdmId] ?? 75;
      const citedFactors = CANNED_CITED_FACTORS[conjunction.cdmId] ?? ['Probability of collision', 'Fuel budget'];
      const recOption = options.find((o) => o.label === 'B') || options[1] || options[0];
      onComplete({
        conjunctionId: conjunction.cdmId,
        recommendedOptionId: recOption?.id ?? '',
        reasoning: canned,
        citedFactors,
        confidence,
        generatedAt: formatISO(new Date()),
      });
    } else {
      const generic = generateGenericReasoning(conjunction, options);
      await simulateStream(generic, onChunk);
      const recOption = options.find((o) => o.label === 'B') || options[0];
      onComplete({
        conjunctionId: conjunction.cdmId,
        recommendedOptionId: recOption?.id ?? '',
        reasoning: generic,
        citedFactors: ['Probability of collision', 'Fuel budget', 'Mission criticality'],
        confidence: 72,
        generatedAt: formatISO(new Date()),
      });
    }
    return;
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY, dangerouslyAllowBrowser: true });
  let fullText = '';

  try {
    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(conjunction, options) }],
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        fullText += chunk.delta.text;
        onChunk(chunk.delta.text);
      }
    }

    const { confidence, recommendedLabel, citedFactors } = parseReasoning(fullText, options);
    const recOption = options.find((o) => o.label === recommendedLabel) || options[1] || options[0];

    onComplete({
      conjunctionId: conjunction.cdmId,
      recommendedOptionId: recOption?.id ?? '',
      reasoning: fullText,
      citedFactors,
      confidence,
      generatedAt: formatISO(new Date()),
    });
  } catch (err) {
    console.warn('[Agent] Falling back to canned reasoning:', err);
    // Fall back gracefully
    const fallback = canned || generateGenericReasoning(conjunction, options);
    await simulateStream(fallback, onChunk);
    const recOption = options.find((o) => o.label === 'B') || options[0];
    onComplete({
      conjunctionId: conjunction.cdmId,
      recommendedOptionId: recOption?.id ?? '',
      reasoning: fallback,
      citedFactors: CANNED_CITED_FACTORS[conjunction.cdmId] ?? ['Probability of collision'],
      confidence: CANNED_CONFIDENCE[conjunction.cdmId] ?? 75,
      generatedAt: formatISO(new Date()),
    });
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

async function simulateStream(text: string, onChunk: (t: string) => void): Promise<void> {
  const words = text.split(' ');
  for (const word of words) {
    onChunk(word + ' ');
    await new Promise((r) => setTimeout(r, 18));
  }
}

function parseReasoning(text: string, options: ManeuverOption[]): {
  confidence: number;
  recommendedLabel: 'A' | 'B' | 'C';
  citedFactors: string[];
} {
  const confMatch = text.match(/CONFIDENCE:\s*(\d+)/i);
  const confidence = confMatch ? parseInt(confMatch[1]) : 75;

  const recMatch = text.match(/RECOMMENDATION:\s*Option\s*([ABC])/i);
  const recommendedLabel = (recMatch?.[1] as 'A' | 'B' | 'C') ?? 'B';

  const factors: string[] = [];
  const factorPatterns = [
    /P_c/i, /probability/i, /fuel/i, /criticality/i, /velocity/i, /miss distance/i,
    /maneuver history/i, /covariance/i, /tracking/i, /mission/i, /budget/i,
  ];
  const labels = [
    'Probability of collision', 'Probability of collision', 'Fuel budget', 'Mission criticality',
    'Relative velocity', 'Miss distance', 'Prior maneuver history', 'Tracking covariance',
    'Tracking covariance', 'Mission impact', 'Fuel budget',
  ];
  factorPatterns.forEach((p, i) => {
    if (p.test(text) && !factors.includes(labels[i])) factors.push(labels[i]);
  });

  return { confidence, recommendedLabel, citedFactors: factors.slice(0, 6) };
}

function generateGenericReasoning(conjunction: Conjunction, options: ManeuverOption[]): string {
  const pc = conjunction.probabilityOfCollision;
  const threshold = 1e-4;
  const severity = pc > threshold ? 'HIGH-PRIORITY' : 'MEDIUM-PRIORITY';

  return `ASSESSMENT: This is a ${severity} conjunction — P_c of ${pc.toExponential(2)} ${pc > threshold ? 'exceeds' : 'approaches'} the action threshold with ${Math.round((new Date(conjunction.tca).getTime() - Date.now()) / 3600000)} hours to TCA.

KEY FACTORS:
- P_c = ${pc.toExponential(2)} ${pc > threshold ? 'requires immediate maneuver decision' : 'warrants close monitoring and likely maneuver'}.
- ${conjunction.primary.name} carries ${conjunction.primary.missionCriticality} mission criticality.
- Fuel remaining: ${conjunction.primary.fuelRemainingKg ?? 'unknown'} kg (sufficient for maneuver options).
- Relative velocity of ${conjunction.relativeVelocityKmS} km/s means any collision is catastrophic.
- Miss distance of ${conjunction.missDistanceM}m provides no safe margin at this closing speed.

OPTIONS ANALYSIS:
Option A achieves maximum separation at highest fuel cost. Option B provides adequate P_c reduction at moderate cost. Option C achieves insufficient separation and should only be considered if P_c drops below threshold in next CDM update.

RECOMMENDATION: Option B. Balances risk reduction against fuel conservation for the remainder of the mission year.

CONFIDENCE: 74`;
}
