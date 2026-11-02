import { forkChangelogEntrySchema, forkChangelogSchema } from './fork-changelog.schema';

import { describe, expect, it } from 'vitest';

const entry = (over: Record<string, unknown> = {}) => ({
  id: '2030-01-01-example',
  date: '2030-01-01',
  title: 'Example change',
  items: [{ kind: 'added', text: 'Something new.' }],
  ...over,
});

describe('forkChangelogEntrySchema', () => {
  it('accepts a well-formed entry', () => {
    expect(forkChangelogEntrySchema.safeParse(entry()).success).toBe(true);
  });

  it('rejects a date that is not YYYY-MM-DD', () => {
    expect(forkChangelogEntrySchema.safeParse(entry({ date: '01-01-2030' })).success).toBe(false);
  });

  it('rejects a date that does not exist', () => {
    expect(forkChangelogEntrySchema.safeParse(entry({ date: '2030-02-31' })).success).toBe(false);
  });

  it('rejects an unknown item kind', () => {
    expect(forkChangelogEntrySchema.safeParse(entry({ items: [{ kind: 'removed', text: 'x' }] })).success).toBe(false);
  });

  it('rejects an entry without items', () => {
    expect(forkChangelogEntrySchema.safeParse(entry({ items: [] })).success).toBe(false);
  });
});

describe('forkChangelogSchema', () => {
  it('accepts an empty list', () => {
    expect(forkChangelogSchema.safeParse([]).success).toBe(true);
  });

  it('rejects a duplicate entry id', () => {
    const result = forkChangelogSchema.safeParse([entry(), entry({ title: 'Other' })]);
    expect(result.success).toBe(false);
  });
});
