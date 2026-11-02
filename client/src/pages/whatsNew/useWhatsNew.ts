import type { ForkChangelogEntry } from '@trek/shared';
import { useEffect, useState } from 'react';
import { forkChangelogRepo } from '../../repo/forkChangelogRepo';

/** State + data loading for the What's new page (see PATTERN.md). */
export function useWhatsNew() {
  const [entries, setEntries] = useState<ForkChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    forkChangelogRepo
      .list()
      .then((list) => {
        if (!alive) return;
        setEntries(list);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { entries, loading, error };
}
