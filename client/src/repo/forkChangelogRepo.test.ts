import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forkChangelogRepo } from './forkChangelogRepo';

const mocks = vi.hoisted(() => ({ offline: false, list: vi.fn() }));

vi.mock('../sync/networkMode', () => ({ isEffectivelyOffline: () => mocks.offline }));
vi.mock('../api/forkChangelog', () => ({ forkChangelogApi: { list: mocks.list } }));

describe('forkChangelogRepo', () => {
  beforeEach(() => {
    mocks.offline = false;
    mocks.list.mockReset();
  });

  it('returns what the api returns while online', async () => {
    mocks.list.mockResolvedValue([{ id: 'a' }]);
    await expect(forkChangelogRepo.list()).resolves.toEqual([{ id: 'a' }]);
  });

  it('rejects without calling the api while offline', async () => {
    mocks.offline = true;
    await expect(forkChangelogRepo.list()).rejects.toThrow('requires a connection');
    expect(mocks.list).not.toHaveBeenCalled();
  });
});
