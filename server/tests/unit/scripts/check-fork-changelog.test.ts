import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = path.join(__dirname, '../../../scripts/check-fork-changelog.mjs');
const SHIPPED_FILE = path.join(__dirname, '../../../assets/fork-changelog.json');

const entry = {
  id: '2030-01-01-example',
  date: '2030-01-01',
  title: 'Example',
  items: [{ kind: 'added', text: 'A.' }],
};

let dir: string | undefined;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

function run(file?: string): { status: number; stderr: string } {
  try {
    execFileSync('node', file ? [SCRIPT, file] : [SCRIPT], { stdio: 'pipe' });
    return { status: 0, stderr: '' };
  } catch (err) {
    const e = err as { status: number; stderr: Buffer };
    return { status: e.status, stderr: e.stderr.toString() };
  }
}

function write(content: string): string {
  dir = mkdtempSync(path.join(tmpdir(), 'check-fork-changelog-'));
  const file = path.join(dir, 'changelog.json');
  writeFileSync(file, content);
  return file;
}

describe('check-fork-changelog script', () => {
  it('passes the shipped changelog', () => {
    expect(run().status).toBe(0);
    expect(run(SHIPPED_FILE).status).toBe(0);
  });

  it('passes a valid file', () => {
    expect(run(write(JSON.stringify([entry]))).status).toBe(0);
  });

  it('exits non-zero for a file the schema rejects', () => {
    const result = run(write(JSON.stringify([entry, entry])));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('is invalid');
  });

  it('exits non-zero for a file that is not JSON', () => {
    expect(run(write('{ not json')).status).toBe(1);
  });
});
