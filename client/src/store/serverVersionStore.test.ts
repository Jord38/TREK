import { beforeEach, describe, expect, it } from 'vitest';
import { useServerVersionStore } from './serverVersionStore';

const state = () => useServerVersionStore.getState();

beforeEach(() => {
  useServerVersionStore.setState({ first: null, reported: null, firstBuild: null, reportedBuild: null });
});

describe('serverVersionStore', () => {
  it('FE-STORE-SERVERVER-001: keeps the first and the last version reported', () => {
    state().note('5.1.0');
    state().note('5.2.0');
    expect(state().first).toBe('5.1.0');
    expect(state().reported).toBe('5.2.0');
    expect(state().firstBuild).toBeNull();
    expect(state().reportedBuild).toBeNull();
  });

  it('FE-STORE-SERVERVER-002: notes a build change as a change although the version is equal', () => {
    state().note('5.1.0', '5.1.0-jord.3');
    state().note('5.1.0', '5.1.0-jord.4');
    expect(state().first).toBe('5.1.0');
    expect(state().firstBuild).toBe('5.1.0-jord.3');
    expect(state().reported).toBe('5.1.0');
    expect(state().reportedBuild).toBe('5.1.0-jord.4');
  });

  it('FE-STORE-SERVERVER-003: ignores a report that changes neither version nor build', () => {
    state().note('5.1.0', '5.1.0-jord.3');
    const before = state();
    state().note('5.1.0', '5.1.0-jord.3');
    expect(state()).toBe(before);
  });

  it('FE-STORE-SERVERVER-004: a build that is not a release tag counts as no build', () => {
    state().note('5.1.0', 'not a tag!');
    expect(state().reportedBuild).toBeNull();
    state().note('5.1.0', 42);
    expect(state().reportedBuild).toBeNull();
  });

  it('FE-STORE-SERVERVER-005: a report without a valid version is ignored, build or not', () => {
    state().note(undefined, '5.1.0-jord.3');
    expect(state().reported).toBeNull();
    expect(state().reportedBuild).toBeNull();
  });
});
