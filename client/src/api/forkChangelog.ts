import { forkChangelogResponseSchema, type ForkChangelogEntry } from '@trek/shared';
import { apiClient, parseInDev } from './client';

/**
 * GET /api/fork-changelog: the fork's changelog, newest entry first. Online-only
 * by nature, like the help wiki: the page reads it fresh and a failed load shows
 * its error state instead of queuing anything.
 */
export const forkChangelogApi = {
  list: (): Promise<ForkChangelogEntry[]> =>
    apiClient
      .get('/fork-changelog')
      .then((r) => parseInDev(forkChangelogResponseSchema, r.data, 'forkChangelog.list').entries),
};
