const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

type TLEEntry = {
  name: string;
  line1: string;
  line2: string;
};

type CacheEntry = {
  data: TLEEntry[];
  timestamp: number;
};

const CACHE_KEYS: Record<string, string> = {
  active: 'tle_active',
  iridium33: 'tle_iridium33',
  cosmos2251: 'tle_cosmos2251',
  starlink: 'tle_starlink',
};

const CELESTRAK_URLS: Record<string, string> = {
  active: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle',
  iridium33: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium-33-debris&FORMAT=tle',
  cosmos2251: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=cosmos-2251-debris&FORMAT=tle',
  starlink: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle',
};

function parseTLE(raw: string): TLEEntry[] {
  const lines = raw.trim().split('\n').map((l) => l.trim()).filter(Boolean);
  const entries: TLEEntry[] = [];
  for (let i = 0; i < lines.length - 2; i += 3) {
    if (lines[i + 1]?.startsWith('1 ') && lines[i + 2]?.startsWith('2 ')) {
      entries.push({ name: lines[i], line1: lines[i + 1], line2: lines[i + 2] });
    }
  }
  return entries;
}

function getCached(key: string): TLEEntry[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

function setCache(key: string, data: TLEEntry[]): void {
  try {
    const entry: CacheEntry = { data, timestamp: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // quota exceeded — ignore
  }
}

async function fetchTLEGroup(group: string): Promise<TLEEntry[]> {
  const cacheKey = CACHE_KEYS[group];
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(CELESTRAK_URLS[group]);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const entries = parseTLE(text);
    if (entries.length > 0) setCache(cacheKey, entries);
    return entries;
  } catch (err) {
    console.warn(`[Celestrak] Failed to fetch ${group}:`, err);
    return [];
  }
}

export async function fetchAllTLEs(): Promise<{
  iridium33Debris: TLEEntry[];
  cosmos2251Debris: TLEEntry[];
  starlink: TLEEntry[];
}> {
  const [iridium33Debris, cosmos2251Debris, starlink] = await Promise.all([
    fetchTLEGroup('iridium33'),
    fetchTLEGroup('cosmos2251'),
    fetchTLEGroup('starlink'),
  ]);

  return { iridium33Debris, cosmos2251Debris, starlink };
}

export type { TLEEntry };
