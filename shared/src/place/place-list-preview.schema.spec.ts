import { placeListCommitRequestSchema, placeListPreviewResponseSchema } from './place-list-preview.schema';

import { describe, it, expect } from 'vitest';

const base = { key: '0', name: 'Cafe', lat: 35, lng: 139, notes: null, googleFtid: null, country: 'JP' };

describe('placeListPreviewResponseSchema', () => {
  it('accepts a list with one place of each bucket', () => {
    const res = placeListPreviewResponseSchema.safeParse({
      kind: 'list',
      listName: 'Eats',
      places: [
        { ...base, bucket: 'new', match: null, hint: null },
        {
          ...base,
          key: '1',
          bucket: 'check',
          match: null,
          hint: { kind: 'same-name-far', placeId: 3, name: 'Cafe', distanceM: 1500 },
        },
        {
          ...base,
          key: '2',
          country: null,
          bucket: 'existing',
          match: { placeId: 4, name: 'Cafe', distanceM: 10, reason: 'name' },
          hint: null,
        },
      ],
    });
    expect(res.success).toBe(true);
  });

  it('accepts the directions answer', () => {
    expect(placeListPreviewResponseSchema.safeParse({ kind: 'directions' }).success).toBe(true);
  });

  it('rejects an unknown bucket', () => {
    const res = placeListPreviewResponseSchema.safeParse({
      kind: 'list',
      listName: 'Eats',
      places: [{ ...base, bucket: 'maybe', match: null, hint: null }],
    });
    expect(res.success).toBe(false);
  });
});

describe('placeListCommitRequestSchema', () => {
  it('accepts no places with one link', () => {
    const res = placeListCommitRequestSchema.safeParse({
      listName: 'Eats',
      places: [],
      link: [{ placeId: 3, googleFtid: '0x1:0x2' }],
      movePin: [],
    });
    expect(res.success).toBe(true);
  });

  it('rejects a link without a Google id', () => {
    const res = placeListCommitRequestSchema.safeParse({
      listName: 'Eats',
      places: [],
      link: [{ placeId: 3, googleFtid: '' }],
      movePin: [],
    });
    expect(res.success).toBe(false);
  });

  const place = { name: 'Cafe', lat: 35, lng: 139, notes: null, googleFtid: null };
  const commit = (over: Record<string, unknown>) =>
    placeListCommitRequestSchema.safeParse({ listName: 'Eats', places: [], link: [], movePin: [], ...over }).success;

  it('accepts a name of 200 and notes of 2000 characters', () => {
    expect(commit({ places: [{ ...place, name: 'n'.repeat(200), notes: 'x'.repeat(2000) }] })).toBe(true);
  });

  it('rejects a name over 200, notes over 2000 or a list name over 200 characters', () => {
    expect(commit({ places: [{ ...place, name: 'n'.repeat(201) }] })).toBe(false);
    expect(commit({ places: [{ ...place, notes: 'x'.repeat(2001) }] })).toBe(false);
    expect(commit({ listName: 'l'.repeat(201) })).toBe(false);
  });

  it('rejects coordinates outside the globe', () => {
    expect(commit({ places: [{ ...place, lat: 90.5 }] })).toBe(false);
    expect(commit({ places: [{ ...place, lng: -180.5 }] })).toBe(false);
    expect(commit({ movePin: [{ placeId: 1, lat: -91, lng: 0, googleFtid: null }] })).toBe(false);
    expect(commit({ movePin: [{ placeId: 1, lat: 0, lng: 181, googleFtid: null }] })).toBe(false);
  });

  it('rejects more than 1000 places, links or pin moves', () => {
    expect(commit({ places: Array(1000).fill(place) })).toBe(true);
    expect(commit({ places: Array(1001).fill(place) })).toBe(false);
    expect(commit({ link: Array(1001).fill({ placeId: 1, googleFtid: 'f' }) })).toBe(false);
    expect(commit({ movePin: Array(1001).fill({ placeId: 1, lat: 0, lng: 0, googleFtid: null }) })).toBe(false);
  });
});
