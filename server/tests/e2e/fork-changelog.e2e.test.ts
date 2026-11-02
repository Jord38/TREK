/**
 * Fork changelog: live-since recording, who gets an entry, ordering, dismissal and
 * GET /api/fork-changelog.
 */
import { buildApp } from '../../src/bootstrap';
import { Users } from '../../src/db/entities/Users.entity';
import { ForkChangelogService } from '../../src/nest/system-notices/fork-changelog.service';
import { FORK_CHANGELOG_LIVE_KEY_PREFIX, forkChangelogNotice } from '../../src/systemNotices/fork-changelog';
import { SYSTEM_NOTICES } from '../../src/systemNotices/registry';
import type { SystemNotice } from '../../src/systemNotices/types';
import { updateRows } from '../helpers/factories/rows';
import { readAppSetting, setAppSetting } from '../helpers/factories/settings';
import { makeUser } from '../helpers/factories/users';
import { sessionCookie } from './harness';
import { MikroORM } from '@mikro-orm/core';
import type { INestApplication } from '@nestjs/common';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let nestApp: INestApplication;
let orm: MikroORM;

const OLDER = forkChangelogNotice({
  id: '2030-01-01-older',
  date: '2030-01-01',
  title: 'Older',
  items: [{ kind: 'added', text: 'Older thing.' }],
});
const NEWER = forkChangelogNotice({
  id: '2030-02-01-newer',
  date: '2030-02-01',
  title: 'Newer',
  items: [{ kind: 'changed', text: 'Newer thing.' }],
});
const TOUR: SystemNotice = {
  id: 'test-welcome-tour',
  display: 'modal',
  severity: 'info',
  titleKey: 'system_notice.test_tour.title',
  bodyKey: 'system_notice.test_tour.body',
  dismissible: true,
  conditions: [],
  publishedAt: '2029-01-01T00:00:00Z',
  priority: 120,
};
const TEST_NOTICES = [OLDER, NEWER, TOUR];
const LIVE = '2030-03-01T12:00:00.000Z';

beforeAll(async () => {
  nestApp = await buildApp();
  orm = nestApp.get(MikroORM);
  SYSTEM_NOTICES.push(...TEST_NOTICES);
});

afterAll(async () => {
  for (const n of TEST_NOTICES) SYSTEM_NOTICES.splice(SYSTEM_NOTICES.indexOf(n), 1);
  await nestApp.close();
});

async function userCreated(createdAt: string, loginCount = 5) {
  const { user } = await makeUser(orm);
  await updateRows(
    orm,
    Users,
    { id: user.id },
    { created_at: createdAt, login_count: loginCount, first_seen_version: '9.0.0' },
  );
  return user;
}

async function openLive() {
  await Promise.all(
    ['2030-01-01-older', '2030-02-01-newer'].map((id) =>
      setAppSetting(orm, `${FORK_CHANGELOG_LIVE_KEY_PREFIX}${id}`, LIVE),
    ),
  );
}

const activeIds = async (userId: number) => {
  const res = await request(nestApp.getHttpServer())
    .get('/api/system-notices/active')
    .set('Cookie', sessionCookie(userId));
  expect(res.status).toBe(200);
  return (res.body as { id: string }[]).map((n) => n.id);
};

describe('live-since recording', () => {
  const key = `${FORK_CHANGELOG_LIVE_KEY_PREFIX}2026-11-02-fork-start`;

  it('records the time of the first start for every shipped entry', async () => {
    expect(Date.parse((await readAppSetting(orm, key)) ?? '')).not.toBeNaN();
  });

  it('keeps the first time on a later start', async () => {
    await setAppSetting(orm, key, LIVE);
    await nestApp.get(ForkChangelogService).onApplicationBootstrap();
    expect(await readAppSetting(orm, key)).toBe(LIVE);
  });
});

describe('who gets an entry', () => {
  it('shows entries to an account created before they went live, whatever its login count', async () => {
    await openLive();
    const old = await userCreated('2030-02-15 10:00:00', 12);
    expect(await activeIds(old.id)).toEqual(expect.arrayContaining([OLDER.id, NEWER.id]));
  });

  it('does not show them to an account created after, even on its first login', async () => {
    await openLive();
    const fresh = await userCreated('2030-03-02 10:00:00', 1);
    const ids = await activeIds(fresh.id);
    expect(ids).not.toContain(OLDER.id);
    expect(ids).not.toContain(NEWER.id);
  });

  it('lists the welcome tour first, then entries newest first', async () => {
    await openLive();
    const old = await userCreated('2030-02-15 10:00:00');
    const ids = (await activeIds(old.id)).filter((id) => [TOUR.id, OLDER.id, NEWER.id].includes(id));
    expect(ids).toEqual([TOUR.id, NEWER.id, OLDER.id]);
  });

  it('places entries before the release notes', async () => {
    await openLive();
    const old = await userCreated('2030-02-15 10:00:00');
    const ids = await activeIds(old.id);
    if (ids.includes('release-notes')) expect(ids.indexOf(OLDER.id)).toBeLessThan(ids.indexOf('release-notes'));
  });
});

describe('dismissing', () => {
  it('leaves the other entry showing', async () => {
    await openLive();
    const old = await userCreated('2030-02-15 10:00:00');
    const res = await request(nestApp.getHttpServer())
      .post(`/api/system-notices/${NEWER.id}/dismiss`)
      .set('Cookie', sessionCookie(old.id));
    expect(res.status).toBe(204);
    const ids = await activeIds(old.id);
    expect(ids).not.toContain(NEWER.id);
    expect(ids).toContain(OLDER.id);
  });

  it('accepts the shipped entry id', async () => {
    const old = await userCreated('2030-02-15 10:00:00');
    const res = await request(nestApp.getHttpServer())
      .post('/api/system-notices/fork-changelog:2026-11-02-fork-start/dismiss')
      .set('Cookie', sessionCookie(old.id));
    expect(res.status).toBe(204);
  });
});

describe('GET /api/fork-changelog', () => {
  it('returns 401 without a session', async () => {
    expect((await request(nestApp.getHttpServer()).get('/api/fork-changelog')).status).toBe(401);
  });

  it('returns the validated entries to a logged-in user', async () => {
    const { user } = await makeUser(orm);
    const res = await request(nestApp.getHttpServer()).get('/api/fork-changelog').set('Cookie', sessionCookie(user.id));
    expect(res.status).toBe(200);
    expect(res.body.entries.map((e: { id: string }) => e.id)).toContain('2026-11-02-fork-start');
  });
});
