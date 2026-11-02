import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../tests/helpers/msw/server';
import { forkChangelogApi } from './forkChangelog';

describe('forkChangelogApi.list', () => {
  it('reads /api/fork-changelog and unwraps the entries', async () => {
    const entry = { id: 'a', date: '2030-01-02', title: 'Made up', items: [{ kind: 'added', text: 'Something.' }] };
    server.use(http.get('/api/fork-changelog', () => HttpResponse.json({ entries: [entry] })));
    await expect(forkChangelogApi.list()).resolves.toEqual([entry]);
  });

  it('rejects with the server error', async () => {
    server.use(http.get('/api/fork-changelog', () => HttpResponse.json({ error: 'nope' }, { status: 500 })));
    await expect(forkChangelogApi.list()).rejects.toBeTruthy();
  });
});
