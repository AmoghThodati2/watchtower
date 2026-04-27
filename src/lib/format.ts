import { formatDistanceToNow, differenceInSeconds, formatISO } from 'date-fns';

export function formatPc(pc: number): string {
  if (pc === 0) return '< 1×10⁻⁷';
  const exp = Math.floor(Math.log10(pc));
  const mantissa = pc / Math.pow(10, exp);
  const mantStr = mantissa.toFixed(1).replace(/\.0$/, '');
  return `${mantStr}×10${superscript(exp)}`;
}

function superscript(n: number): string {
  const map: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻',
  };
  return String(n).split('').map((c) => map[c] || c).join('');
}

export function formatPcShort(pc: number): string {
  if (pc < 1e-7) return '< 1e-7';
  return pc.toExponential(1);
}

export function pcSeverity(pc: number): 'green' | 'amber' | 'red' {
  if (pc < 1e-5) return 'green';
  if (pc < 1e-4) return 'amber';
  return 'red';
}

export function pcColor(pc: number): string {
  const s = pcSeverity(pc);
  return s === 'green' ? '#00E676' : s === 'amber' ? '#FFB020' : '#FF3838';
}

export function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
  return `${Math.round(m)} m`;
}

export function formatTCA(isoDate: string): string {
  const d = new Date(isoDate);
  return formatDistanceToNow(d, { addSuffix: false });
}

export function formatCountdown(isoDate: string): string {
  const now = Date.now();
  const target = new Date(isoDate).getTime();
  const diffS = Math.max(0, Math.floor((target - now) / 1000));

  const h = Math.floor(diffS / 3600);
  const m = Math.floor((diffS % 3600) / 60);
  const s = diffS % 60;

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatCountdownHuman(isoDate: string): string {
  const now = Date.now();
  const target = new Date(isoDate).getTime();
  const diffS = Math.max(0, Math.floor((target - now) / 1000));

  const h = Math.floor(diffS / 3600);
  const m = Math.floor((diffS % 3600) / 60);

  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatUTC(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

export function formatUTCShort(isoDate: string): string {
  return isoDate.replace('T', ' ').slice(0, 19) + ' UTC';
}

export function formatDeltaV(ms: number): string {
  return `${ms.toFixed(2)} m/s`;
}

export function formatFuel(kg: number): string {
  return `${kg.toFixed(2)} kg`;
}

export function formatMissionImpact(days: number): string {
  if (days < 1) return `${Math.round(days * 24)}h`;
  return `${days.toFixed(1)} days`;
}
