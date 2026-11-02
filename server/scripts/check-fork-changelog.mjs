#!/usr/bin/env node
/*
 * Fails the image build when assets/fork-changelog.json is malformed, which the
 * server would otherwise survive by silently showing no changelog.
 * Usage: node scripts/check-fork-changelog.mjs [file]
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { forkChangelogSchema } from '@trek/shared';

const file =
  process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'fork-changelog.json');

try {
  const entries = forkChangelogSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
  console.log(`fork-changelog: ${entries.length} entries OK`);
} catch (err) {
  console.error(`fork-changelog: ${file} is invalid: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
