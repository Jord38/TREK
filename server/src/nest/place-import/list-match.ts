/**
 * Classifies one place of an imported list against the places already in a trip.
 *
 * Google and TREK's own search put the same place up to ~600 m apart, so the stronger the
 * name match, the further apart the pins may be.
 */

export interface MatchTarget {
  id: number;
  name: string | null;
  lat: number | null;
  lng: number | null;
  google_place_id: string | null;
  google_ftid: string | null;
  route_geometry: string | null;
}

export interface MatchCandidate {
  name: string;
  lat: number;
  lng: number;
  googleFtid: string | null;
}

export type MatchReason = 'id' | 'name' | 'core' | 'core-far' | 'part';
export type HintKind = 'same-name-far' | 'similar-nearby' | 'next-to';

export interface ListMatch {
  bucket: 'new' | 'check' | 'existing';
  match: { placeId: number; name: string; distanceM: number | null; reason: MatchReason } | null;
  hint: { kind: HintKind; placeId: number; name: string; distanceM: number } | null;
}

export const SAME_NAME_MAX_M = 2000;
export const SAME_CORE_MAX_M = 1000;
export const CHECK_CORE_MAX_M = 3000;
export const PART_MAX_M = 500;
export const PART_MIN_CHARS = 4;
/** Below this share of the longer core, a contained name is a different place nearby ("Round One" in "Round One Stadium Sennichimae"). */
export const PART_MIN_SHARE = 0.6;
export const NEXT_TO_MAX_M = 25;

const EARTH_RADIUS_M = 6_371_000;

const GENERIC_WORDS = new Set([
  'the',
  'bar',
  'cafe',
  'restaurant',
  'shop',
  'store',
  'lounge',
  'club',
  'stadium',
  'tokyo',
  'osaka',
  'shibuya',
  'shinsaibashi',
  'japan',
  '東京',
  '大阪',
  '渋谷',
  '心斎橋',
  '日本',
]);

const LATIN_TOKEN = /[a-z0-9]+/g;
const CJK_NOISE = /[\s\p{P}\p{S}]/gu;

function latinTokens(name: string): string[] {
  return (
    name
      .normalize('NFKC')
      .toLowerCase()
      .replace(/['’`´]/g, '')
      .match(LATIN_TOKEN) ?? []
  );
}

function nfkcWords(name: string): string[] {
  return name
    .normalize('NFKC')
    .toLowerCase()
    .split(/[\s\p{P}\p{S}]+/u)
    .filter(Boolean);
}

export function normalizeName(name: string): string {
  const latin = latinTokens(name).join('');
  if (latin) return latin;
  return name.normalize('NFKC').toLowerCase().replace(CJK_NOISE, '');
}

export function coreName(name: string): string {
  const words = latinTokens(name).length ? latinTokens(name) : nfkcWords(name);
  const kept = words.filter((w) => !GENERIC_WORDS.has(w)).join('');
  return kept || normalizeName(name);
}

function distanceMetres(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

const RANK = { new: 0, check: 1, existing: 2 } as const;
const HINT_RANK: Record<HintKind, number> = { 'next-to': 0, 'similar-nearby': 1, 'same-name-far': 2 };

/** How much of the longer core the shorter one covers when it is contained in it, else 0. */
function partShare(a: string, b: string): number {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length < PART_MIN_CHARS || !long.includes(short)) return 0;
  return short.length / long.length;
}

type Found = NonNullable<ListMatch['match']>;

function judgeTarget(
  candidate: MatchCandidate,
  names: { norm: string; core: string },
  t: MatchTarget,
): { bucket: ListMatch['bucket']; found: Found | null; hint: ListMatch['hint'] } {
  const idHit = candidate.googleFtid !== null && candidate.googleFtid === t.google_ftid;
  const distanceM =
    t.lat !== null && t.lng !== null && !t.route_geometry
      ? distanceMetres(candidate.lat, candidate.lng, t.lat, t.lng)
      : null;
  const placeName = t.name ?? '';
  const make = (reason: MatchReason): Found => ({ placeId: t.id, name: placeName, distanceM, reason });
  const none = { bucket: 'new' as const, found: null, hint: null };

  if (idHit) return { bucket: 'existing', found: make('id'), hint: null };
  if (distanceM === null || !t.name) return none;

  const tNorm = normalizeName(t.name);
  const tCore = coreName(t.name);
  const sameNorm = !!names.norm && names.norm === tNorm;
  const sameCore = !!names.core && names.core === tCore;

  if (sameNorm && distanceM <= SAME_NAME_MAX_M) return { bucket: 'existing', found: make('name'), hint: null };
  if (sameCore && distanceM <= SAME_CORE_MAX_M) return { bucket: 'existing', found: make('core'), hint: null };
  if (sameCore && distanceM <= CHECK_CORE_MAX_M) return { bucket: 'check', found: make('core-far'), hint: null };
  const share = sameCore ? 0 : partShare(names.core, tCore);
  if (share >= PART_MIN_SHARE && distanceM <= PART_MAX_M) {
    return { bucket: 'check', found: make('part'), hint: null };
  }
  if (share > 0 && distanceM <= PART_MAX_M) {
    return { ...none, hint: { kind: 'similar-nearby', placeId: t.id, name: placeName, distanceM } };
  }
  if (sameNorm) {
    return { ...none, hint: { kind: 'same-name-far', placeId: t.id, name: placeName, distanceM } };
  }
  if (!sameCore && distanceM <= NEXT_TO_MAX_M) {
    return { ...none, hint: { kind: 'next-to', placeId: t.id, name: placeName, distanceM } };
  }
  return none;
}

function betterHint(a: ListMatch['hint'], b: ListMatch['hint']): ListMatch['hint'] {
  if (!a || !b) return a ?? b;
  if (a.kind !== b.kind) return HINT_RANK[a.kind] > HINT_RANK[b.kind] ? a : b;
  return b.distanceM < a.distanceM ? b : a;
}

export function matchListPlace(candidate: MatchCandidate, targets: readonly MatchTarget[]): ListMatch {
  const names = { norm: normalizeName(candidate.name), core: coreName(candidate.name) };
  let best: { bucket: ListMatch['bucket']; found: Found } | null = null;
  let hint: ListMatch['hint'] = null;

  for (const t of targets) {
    const r = judgeTarget(candidate, names, t);
    if (r.found) {
      const closer = best && best.found.distanceM !== null && (r.found.distanceM ?? Infinity) < best.found.distanceM;
      if (!best || RANK[r.bucket] > RANK[best.bucket] || (RANK[r.bucket] === RANK[best.bucket] && closer)) {
        best = { bucket: r.bucket, found: r.found };
      }
    }
    hint = betterHint(hint, r.hint);
  }

  if (best) return { bucket: best.bucket, match: best.found, hint: null };
  return { bucket: 'new', match: null, hint };
}
