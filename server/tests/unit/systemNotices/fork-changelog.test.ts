import { evaluate } from '../../../src/systemNotices/conditions.js';
import {
  FORK_CHANGELOG_LIVE_KEY_PREFIX,
  forkChangelogNotice,
  loadForkChangelog,
  newestFirst,
} from '../../../src/systemNotices/fork-changelog.js';
import { SYSTEM_NOTICES } from '../../../src/systemNotices/registry.js';
import type { NoticeCondition, SystemNotice } from '../../../src/systemNotices/types.js';
import { forkChangelogSchema, type ForkChangelogEntry } from '@trek/shared';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const SHIPPED_FILE = path.resolve(__dirname, '../../../assets/fork-changelog.json');

const entry = (over: Partial<ForkChangelogEntry> = {}): ForkChangelogEntry => ({
  id: '2030-01-01-example',
  date: '2030-01-01',
  title: 'Example change',
  items: [
    { kind: 'added', text: 'First thing.' },
    { kind: 'fixed', text: 'Second thing.' },
  ],
  ...over,
});

describe('the shipped fork-changelog.json', () => {
  it('passes the shared schema', () => {
    const parsed = forkChangelogSchema.safeParse(JSON.parse(fs.readFileSync(SHIPPED_FILE, 'utf8')));
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.data?.some((e) => e.id === '2026-11-02-fork-start')).toBe(true);
  });

  it('is what the server loads', () => {
    expect(loadForkChangelog().map((e) => e.id)).toContain('2026-11-02-fork-start');
  });
});

describe('loadForkChangelog', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fork-changelog-'));
  afterEach(() => vi.restoreAllMocks());

  it('returns no entries and logs once for a malformed file, instead of throwing', () => {
    const file = path.join(dir, 'bad.json');
    fs.writeFileSync(file, JSON.stringify([entry(), entry()]));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(loadForkChangelog(file)).toEqual([]);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('returns no entries for a missing file', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(loadForkChangelog(path.join(dir, 'missing.json'))).toEqual([]);
  });
});

describe('newestFirst', () => {
  it('orders by date descending, later ids first on the same day', () => {
    const a = entry({ id: 'a', date: '2030-01-01' });
    const b = entry({ id: 'b', date: '2030-02-01' });
    const c = entry({ id: 'c', date: '2030-02-01' });
    expect(newestFirst([a, b, c]).map((e) => e.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('forkChangelogNotice', () => {
  it('maps an entry to a modal notice carrying its items as a Markdown list', () => {
    const notice = forkChangelogNotice(entry());
    expect(notice).toMatchObject({
      id: 'fork-changelog:2030-01-01-example',
      display: 'modal',
      priority: 115,
      publishedAt: '2030-01-01T00:00:00Z',
      conditions: [{ kind: 'accountCreatedBeforeLive', entryId: '2030-01-01-example' }],
      titleParams: { title: 'Example change' },
      bodyParams: { list: '- First thing.\n- Second thing.' },
      cta: { kind: 'nav', href: '/whats-new' },
    });
  });
});

describe('registry', () => {
  it('carries a notice for every shipped entry, so dismissing one is accepted', () => {
    for (const e of loadForkChangelog()) {
      expect(SYSTEM_NOTICES.some((n) => n.id === `fork-changelog:${e.id}`)).toBe(true);
    }
  });
});

describe('accountCreatedBeforeLive', () => {
  const notice: SystemNotice = {
    ...forkChangelogNotice(entry()),
    conditions: [{ kind: 'accountCreatedBeforeLive', entryId: 'e1' } satisfies NoticeCondition],
  };
  const ctx = (created_at: string | null, live: string | null, login_count = 5) => ({
    user: { login_count, first_seen_version: '1.0.0', role: 'user', noTrips: 1, created_at },
    currentAppVersion: '2.0.0',
    now: new Date('2030-06-01T00:00:00Z'),
    addonEnabled: () => false,
    managed: false,
    settingFlag: () => false,
    forkLiveSince: () => live,
  });
  const LIVE = '2030-03-01T12:00:00.000Z';

  it('passes for an account created before the entry went live', () => {
    expect(evaluate(notice, ctx('2030-03-01 11:59:59', LIVE))).toBe(true);
  });

  it('fails for an account created after, whatever its login count', () => {
    expect(evaluate(notice, ctx('2030-03-01 12:00:01', LIVE, 1))).toBe(false);
    expect(evaluate(notice, ctx('2030-03-01 12:00:01', LIVE, 99))).toBe(false);
  });

  it('reads an ISO timestamp with a zone as well', () => {
    expect(evaluate(notice, ctx('2030-03-01T11:00:00.000Z', LIVE))).toBe(true);
  });

  it('fails while no live time is recorded', () => {
    expect(evaluate(notice, ctx('2020-01-01 00:00:00', null))).toBe(false);
  });

  it('exposes the live key prefix the server stores under', () => {
    expect(FORK_CHANGELOG_LIVE_KEY_PREFIX).toBe('fork_changelog_live:');
  });
});
