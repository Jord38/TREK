import { placeListPreviewResponseSchema } from './place-list-preview.schema';

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
