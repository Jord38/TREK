import { forkChangelogApi } from '../api/forkChangelog';
import { isEffectivelyOffline } from '../sync/networkMode';

/**
 * The fork's changelog for the What's new page. Online only: nothing is kept and
 * nothing is queued, so offline the call is not made and the page shows its error state.
 */
export const forkChangelogRepo = {
  list() {
    if (isEffectivelyOffline()) return Promise.reject(new Error('The changelog requires a connection'));
    return forkChangelogApi.list();
  },
};
