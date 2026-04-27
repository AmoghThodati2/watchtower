// Four major fragmentation events — all open CORS endpoints, no auth required.
const SOURCES = [
  {
    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium-33-debris&FORMAT=tle',
    key: 'debris_field_iridium33',
    parentEvent: 'IRIDIUM-33',
  },
  {
    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=cosmos-2251-debris&FORMAT=tle',
    key: 'debris_field_cosmos2251',
    parentEvent: 'COSMOS-2251',
  },
  {
    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=1999-025&FORMAT=tle',
    key: 'debris_field_fy1c',
    parentEvent: 'FY-1C',
  },
  {
    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=2021-cosmos-1408&FORMAT=tle',
    key: 'debris_field_cosmos1408',
    parentEvent: 'COSMOS-1408',
  },
] as const;

const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface DebrisTLE {
  noradId: number;
  name: string;
  parentEvent: string;
  line1: string;
  line2: string;
}

// ── TLE parsing ───────────────────────────────────────────────────────────────

function parseTLEBlock(raw: string, parentEvent: string): DebrisTLE[] {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
  const entries: DebrisTLE[] = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name  = lines[i];
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];
    if (!line1.startsWith('1 ') || !line2.startsWith('2 ')) continue;
    entries.push({
      noradId: parseInt(line1.slice(2, 7), 10),
      name,
      parentEvent,
      line1,
      line2,
    });
  }
  return entries;
}

// ── localStorage caching (raw TLE text) ──────────────────────────────────────

async function fetchCached(url: string, key: string): Promise<string> {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const { ts, data }: { ts: number; data: string } = JSON.parse(stored);
      if (Date.now() - ts < TTL_MS) return data;
    }
  } catch { /* corrupted entry — fall through to refetch */ }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const data = await res.text();
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch { /* quota exceeded — skip caching */ }
  return data;
}

// ── Deterministic sampling (xorshift32) ──────────────────────────────────────
// Same seed → identical sample every reload so repeated views look the same.

function seededSample<T>(arr: T[], n: number, seed = 0xdeadbeef): T[] {
  if (arr.length <= n) return arr;
  const copy = arr.slice();
  let s = seed >>> 0;
  const rand = () => {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return (s >>> 0) / 0x100000000;
  };
  // Partial Fisher-Yates: select n items in O(n) time
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rand() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function loadDebrisField(cap: number): Promise<DebrisTLE[]> {
  const results = await Promise.allSettled(
    SOURCES.map(async ({ url, key, parentEvent }) => {
      const text = await fetchCached(url, key);
      return parseTLEBlock(text, parentEvent);
    })
  );

  const all: DebrisTLE[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      all.push(...r.value);
    } else {
      console.warn(`[Debris] ${SOURCES[i].parentEvent} failed:`, r.reason);
    }
  });

  console.log(`[Debris] raw entries: ${all.length} → sampling to ${Math.min(all.length, cap)}`);
  return seededSample(all, cap);
}
