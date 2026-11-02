import { logError } from '../nest/audit/audit-log.logger.js';
import type { SystemNotice } from './types.js';
import { forkChangelogSchema, type ForkChangelogEntry } from '@trek/shared';

import fs from 'node:fs';
import path from 'node:path';

export const FORK_CHANGELOG_LIVE_KEY_PREFIX = 'fork_changelog_live:';
export const FORK_CHANGELOG_NOTICE_PREFIX = 'fork-changelog:';

// Above TREK's release notes (110), below the welcome tour (120).
const FORK_CHANGELOG_PRIORITY = 115;

const DEFAULT_FILE = path.join(__dirname, '..', '..', 'assets', 'fork-changelog.json');

/**
 * The shipped file is checked by a test, so a malformed one never reaches users; if it
 * does anyway (a hand-edited image), log once and show no changelog rather than crash.
 */
export function loadForkChangelog(file: string = DEFAULT_FILE): ForkChangelogEntry[] {
  try {
    return newestFirst(forkChangelogSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8'))));
  } catch (err) {
    logError(`[forkChangelog] changelog unreadable, showing none: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

export function newestFirst(entries: readonly ForkChangelogEntry[]): ForkChangelogEntry[] {
  // Same-day entries keep file order: the one added last is the newest.
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => b.entry.date.localeCompare(a.entry.date) || b.index - a.index)
    .map(({ entry }) => entry);
}

export function forkChangelogNotice(entry: ForkChangelogEntry): SystemNotice {
  return {
    id: `${FORK_CHANGELOG_NOTICE_PREFIX}${entry.id}`,
    display: 'modal',
    severity: 'info',
    titleKey: 'system_notice.fork_changelog.title',
    titleParams: { title: entry.title },
    bodyKey: 'system_notice.fork_changelog.body',
    bodyParams: { list: entry.items.map((item) => `- ${item.text}`).join('\n') },
    cta: { kind: 'nav', labelKey: 'system_notice.fork_changelog.cta', href: '/whats-new' },
    dismissible: true,
    conditions: [{ kind: 'accountCreatedBeforeLive', entryId: entry.id }],
    publishedAt: `${entry.date}T00:00:00Z`,
    priority: FORK_CHANGELOG_PRIORITY,
  };
}

export const FORK_CHANGELOG_ENTRIES: readonly ForkChangelogEntry[] = loadForkChangelog();
