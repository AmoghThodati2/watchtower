export const CANNED_REASONING: Record<string, string> = {
  'CDM-2025-11-04-0014': `ASSESSMENT: This is a HIGH-PRIORITY conjunction requiring immediate maneuver decision — P_c of 1.4×10⁻³ exceeds the 1×10⁻⁴ action threshold by over an order of magnitude with only 47 hours to TCA.

KEY FACTORS:
- P_c = 1.4×10⁻³ is 14× above the standard maneuver threshold (1×10⁻⁴), indicating this is not a borderline case.
- ARC-07 carries TIER_1 mission criticality; loss of this asset would impact agricultural monitoring contracts covering 3 continental zones.
- Fuel remaining: 8.2 kg (sufficient for any option including Option A); no fuel-conservation rationale for inaction.
- Miss distance of 280m at 13.2 km/s relative velocity means any physical contact is catastrophic — no survivable outcome.
- ARC-07 has executed 2 prior maneuvers; ground operations team is familiar with the process. Execution risk is low.
- Secondary object is IRIDIUM 33 DEB (Iridium-Cosmos 2009 collision) — a known, well-tracked debris piece with an established trajectory confidence level. CDM uncertainty is low, which raises confidence in the P_c estimate.

OPTIONS ANALYSIS:
Option A (Δv 0.42 m/s, burn T-23h): Reduces P_c to 2.1×10⁻⁶ and achieves 2,100m miss distance — well beyond safe margins. Cost is 0.26 kg of propellant and 8 days of mission life. The large Δv early in the window minimizes sensitivity to tracking uncertainty but the mission impact is disproportionate to what Option B achieves.
Option B (Δv 0.21 m/s, burn T-11h): Achieves 1,450m miss distance and P_c 8.3×10⁻⁶ — still two orders of magnitude below the action threshold. Fuel cost is 0.13 kg and mission life impact is 4 days. The later burn time provides a refinement window for additional CDM updates before committing. This is the decisive advantage.
Option C (Δv 0.08 m/s, burn T-3h): Achieves only 620m miss distance and P_c 3.1×10⁻⁴ — still above the maneuver threshold. This option trades insufficient risk reduction for minimal fuel savings. Do not select Option C unless a subsequent CDM dramatically reduces P_c.

RECOMMENDATION: Option B. It eliminates the threat (P_c drops 168×), preserves fuel budget for the remainder of the mission year, and the T-11h burn time allows one additional CDM update at T-24h before the point of no return. The 4-day mission life cost is acceptable given TIER_1 criticality.

CONFIDENCE: 91`,

  'CDM-2025-11-04-0007': `ASSESSMENT: HIGH-PRIORITY conjunction — P_c of 2.8×10⁻³ exceeds action threshold by 28×, with 29 hours to TCA and a dangerously close 180m miss distance.

KEY FACTORS:
- P_c = 2.8×10⁻³ is the highest in the current queue; this conjunction takes precedence after the ARC-07 event.
- Miss distance of 180m at 12.3 km/s is critically low — this is within the combined hard-body radius of most LEO debris fragments.
- Primary satellite's fuel budget allows Option B execution without compromising annual reserve requirements.
- Shorter TCA window (29h) reduces the benefit of waiting for CDM refinement — burn decision should be made within 6 hours.
- Debris parentage from Iridium-Cosmos 2009 event; covariance matrices for these objects are well-calibrated from 15 years of tracking.
- No maneuver history on this satellite increases operational risk slightly — coordinate with ground station for pre-burn checks.

OPTIONS ANALYSIS:
Option A achieves maximum separation but the fuel cost at this satellite's current budget represents a material risk to mission longevity. Option B provides adequate separation (720m, P_c ~2×10⁻⁵) with acceptable fuel cost. Option C is insufficient — final P_c remains above threshold.

RECOMMENDATION: Option B. Immediate execution recommended given the 29h window and high P_c. Do not wait for next CDM update.

CONFIDENCE: 87`,

  'CDM-2025-11-04-0003': `ASSESSMENT: MEDIUM-PRIORITY — P_c of 1.1×10⁻⁴ is marginally above the action threshold; TCA in 52 hours provides adequate decision time.

KEY FACTORS:
- P_c = 1.1×10⁻⁴ is only slightly above the 1×10⁻⁴ standard threshold; this is a genuine borderline case.
- Miss distance of 430m provides slightly more margin than the hero event, but relative velocity of 11.8 km/s means collision energy would be catastrophic regardless.
- Next CDM update expected in approximately 12 hours; it is reasonable to await this update before committing.
- Satellite carries TIER_2 criticality; fuel conservation has moderate importance but should not override threshold-based maneuver logic.
- Current tracking covariance is elevated — the true P_c could resolve either below or above threshold after next update.

OPTIONS ANALYSIS:
Option A is disproportionate for a borderline case. Option B provides robust separation at low cost. Option C remains marginally viable if next CDM drives P_c below threshold.

RECOMMENDATION: Option B after awaiting next CDM update at T-40h. If P_c drops below 5×10⁻⁵, stand down.

CONFIDENCE: 63`,
};

export const CANNED_CITED_FACTORS: Record<string, string[]> = {
  'CDM-2025-11-04-0014': [
    'Probability of collision',
    'Mission criticality',
    'Fuel budget',
    'Relative velocity',
    'Prior maneuver history',
    'Debris tracking confidence',
  ],
  'CDM-2025-11-04-0007': [
    'Probability of collision',
    'Miss distance',
    'Fuel budget',
    'TCA window',
    'Debris covariance',
  ],
  'CDM-2025-11-04-0003': [
    'Probability of collision',
    'Threshold proximity',
    'CDM update timing',
    'Mission criticality',
    'Tracking covariance',
  ],
};

export const CANNED_CONFIDENCE: Record<string, number> = {
  'CDM-2025-11-04-0014': 91,
  'CDM-2025-11-04-0007': 87,
  'CDM-2025-11-04-0003': 63,
};
