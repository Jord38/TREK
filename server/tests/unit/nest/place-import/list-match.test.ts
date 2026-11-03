import {
  coreName,
  matchListPlace,
  normalizeName,
  type MatchCandidate,
  type MatchTarget,
} from '../../../../src/nest/place-import/list-match';

import { describe, expect, it } from 'vitest';

const LAT = 35.0;
const LNG = 139.0;
// One degree of latitude is about 111.2 km.
const metresNorth = (m: number) => LAT + m / 111_195;

function target(over: Partial<MatchTarget> & { name: string | null }): MatchTarget {
  return {
    id: 1,
    lat: LAT,
    lng: LNG,
    google_place_id: null,
    google_ftid: null,
    route_geometry: null,
    ...over,
  };
}

function candidate(name: string, metres = 0, googleFtid: string | null = null): MatchCandidate {
  return { name, lat: metresNorth(metres), lng: LNG, googleFtid };
}

describe('list matching', () => {
  describe('normalizeName', () => {
    it('ignores case, spaces and punctuation', () => {
      expect(normalizeName('MR.HIRO CAR STUDIO')).toBe(normalizeName('Mr. Hiro Car Studio'));
    });

    it('treats split and joined words alike', () => {
      expect(normalizeName('Fuji Motor Sports Museum')).toBe(normalizeName('FUJI Motorsports Museum'));
    });

    it('keeps an all-CJK name as its NFKC form without spaces or punctuation', () => {
      expect(normalizeName('東京 ・ タワー')).toBe('東京タワー');
    });
  });

  describe('coreName', () => {
    it('drops generic words', () => {
      expect(coreName("Grandfather's bar")).toBe(coreName("Grandfather's"));
    });

    it('drops area names in Latin and CJK spelling alike', () => {
      expect(coreName('Voyager Lounge Shinsaibashi')).toBe(coreName('Voyager Lounge 心斎橋'));
    });

    it('falls back to the normalized name when every word is generic', () => {
      expect(coreName('The Bar')).toBe('thebar');
    });
  });

  describe('matchListPlace', () => {
    it('matches by provider id even 50 km apart', () => {
      const r = matchListPlace(candidate('Anything', 50_000, 'ftid-1'), [
        target({ id: 7, name: 'Other', google_ftid: 'ftid-1' }),
      ]);
      expect(r.bucket).toBe('existing');
      expect(r.match).toMatchObject({ placeId: 7, reason: 'id' });
    });

    it('matches by id for a target without coordinates', () => {
      const r = matchListPlace(candidate('Anything', 0, 'ftid-1'), [
        target({ name: 'Other', lat: null, lng: null, google_ftid: 'ftid-1' }),
      ]);
      expect(r.match?.reason).toBe('id');
    });

    it('matches equal names 260 m apart as existing', () => {
      const r = matchListPlace(candidate('Cats Bar Tokyo', 260), [target({ name: 'CATS BAR TOKYO' })]);
      expect(r.bucket).toBe('existing');
      expect(r.match?.reason).toBe('name');
      expect(r.match?.distanceM).toBeGreaterThan(250);
      expect(r.match?.distanceM).toBeLessThan(270);
    });

    it('does not match equal names by name rule 2.5 km apart', () => {
      const r = matchListPlace(candidate('Blue Falcon Garage', 2500), [target({ name: 'Blue Falcon Garage' })]);
      expect(r.bucket).toBe('check');
      expect(r.match?.reason).toBe('core-far');
    });

    it('treats equal names 400 km apart as new with a same-name-far hint', () => {
      const r = matchListPlace(candidate('Rockrock', 400_000), [target({ id: 3, name: 'Rock Rock' })]);
      expect(r.bucket).toBe('new');
      expect(r.match).toBeNull();
      expect(r.hint).toMatchObject({ kind: 'same-name-far', placeId: 3, name: 'Rock Rock' });
      expect(r.hint?.distanceM).toBeGreaterThan(399_000);
    });

    it('matches equal core names 9 m apart as existing by core', () => {
      const r = matchListPlace(candidate("Grandfather's bar", 9), [target({ name: "Grandfather's" })]);
      expect(r.bucket).toBe('existing');
      expect(r.match?.reason).toBe('core');
    });

    it('flags equal core names 1.2 km apart as check', () => {
      const r = matchListPlace(candidate('Voyager Lounge Shinsaibashi', 1200), [target({ name: 'Voyager' })]);
      expect(r.bucket).toBe('check');
      expect(r.match?.reason).toBe('core-far');
    });

    it('treats equal core names 3.5 km apart as new', () => {
      const r = matchListPlace(candidate('Voyager Lounge', 3500), [target({ name: 'Voyager' })]);
      expect(r.bucket).toBe('new');
      expect(r.match).toBeNull();
    });

    it('flags a contained core within 500 m as check by part when it is at least 60% of the longer core', () => {
      const r = matchListPlace(candidate('Blue Note Jazz', 200), [target({ name: 'Blue Note' })]);
      expect(r.bucket).toBe('check');
      expect(r.match?.reason).toBe('part');
    });

    it('treats a short contained core within 500 m as new with a similar-nearby hint', () => {
      const r = matchListPlace(candidate('Round One Stadium Sennichimae', 200), [target({ id: 4, name: 'Round One' })]);
      expect(r.bucket).toBe('new');
      expect(r.match).toBeNull();
      expect(r.hint).toMatchObject({ kind: 'similar-nearby', placeId: 4, name: 'Round One' });
      expect(r.hint?.distanceM).toBeCloseTo(200, 0);
    });

    it('prefers a similar-nearby hint over a next-to hint', () => {
      const r = matchListPlace(candidate('Round One Stadium Sennichimae', 10), [
        target({ id: 9, name: 'Old Temple' }),
        target({ id: 4, name: 'Round One', lat: metresNorth(210) }),
      ]);
      expect(r.hint).toMatchObject({ kind: 'similar-nearby', placeId: 4 });
    });

    it('treats a contained core 800 m away as new without a hint', () => {
      const r = matchListPlace(candidate('Round One Stadium Sennichimae', 800), [target({ name: 'Round One' })]);
      expect(r.bucket).toBe('new');
      expect(r.hint).toBeNull();
    });

    it('never matches containment with a core under 4 characters', () => {
      const r = matchListPlace(candidate('Abc Garage Annex', 100), [target({ name: 'Abc' })]);
      expect(r.bucket).toBe('new');
    });

    it('hints at an unrelated place 10 m away', () => {
      const r = matchListPlace(candidate('Sunrise Noodles', 10), [target({ id: 9, name: 'Old Temple' })]);
      expect(r.bucket).toBe('new');
      expect(r.hint).toMatchObject({ kind: 'next-to', placeId: 9, name: 'Old Temple' });
    });

    it('gives no hint for an unrelated place 40 m away', () => {
      const r = matchListPlace(candidate('Sunrise Noodles', 40), [target({ name: 'Old Temple' })]);
      expect(r).toEqual({ bucket: 'new', match: null, hint: null });
    });

    it('skips targets without coordinates for distance rules', () => {
      const r = matchListPlace(candidate('Cats Bar', 0), [target({ name: 'Cats Bar', lat: null, lng: null })]);
      expect(r).toEqual({ bucket: 'new', match: null, hint: null });
    });

    it('skips route targets for distance rules', () => {
      const r = matchListPlace(candidate('Cats Bar', 0), [target({ name: 'Cats Bar', route_geometry: '[[0,0]]' })]);
      expect(r).toEqual({ bucket: 'new', match: null, hint: null });
    });

    it('returns new without hint for an empty target list', () => {
      expect(matchListPlace(candidate('Cats Bar'), [])).toEqual({ bucket: 'new', match: null, hint: null });
    });

    it('prefers the stronger bucket over a nearer weaker one', () => {
      const r = matchListPlace(candidate('Blue Falcon Garage', 100), [
        target({ id: 1, name: 'Blue Falcon Garage Annex' }),
        target({ id: 2, name: 'Blue Falcon Garage' }),
      ]);
      expect(r.match).toMatchObject({ placeId: 2, reason: 'name' });
    });

    it('prefers the nearest target within the same bucket', () => {
      const r = matchListPlace(candidate('Blue Falcon Garage', 0), [
        target({ id: 1, name: 'Blue Falcon Garage', lat: metresNorth(800) }),
        target({ id: 2, name: 'Blue Falcon Garage', lat: metresNorth(300) }),
      ]);
      expect(r.match?.placeId).toBe(2);
    });
  });
});
