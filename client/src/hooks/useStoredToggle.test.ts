import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStoredToggle } from './useStoredToggle';

// FE-HOOK-STOREDTOGGLE-001 to FE-HOOK-STOREDTOGGLE-004

const KEY = 'trek_test_toggle';

beforeEach(() => localStorage.clear());

describe('useStoredToggle', () => {
  it('FE-HOOK-STOREDTOGGLE-001: starts off without a stored choice', () => {
    const { result } = renderHook(() => useStoredToggle(KEY));
    expect(result.current[0]).toBe(false);
  });

  it('FE-HOOK-STOREDTOGGLE-002: only a stored 1 starts it on', () => {
    localStorage.setItem(KEY, '1');
    expect(renderHook(() => useStoredToggle(KEY)).result.current[0]).toBe(true);
    localStorage.setItem(KEY, 'yes');
    expect(renderHook(() => useStoredToggle(KEY)).result.current[0]).toBe(false);
  });

  it('FE-HOOK-STOREDTOGGLE-003: flips and stores the choice', () => {
    const { result } = renderHook(() => useStoredToggle(KEY));

    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem(KEY)).toBe('1');

    act(() => result.current[1]());
    expect(result.current[0]).toBe(false);
    expect(localStorage.getItem(KEY)).toBe('0');
  });

  it('FE-HOOK-STOREDTOGGLE-004: a storage that throws still leaves a working switch', () => {
    const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    try {
      const { result } = renderHook(() => useStoredToggle(KEY));
      expect(result.current[0]).toBe(false);
      act(() => result.current[1]());
      expect(result.current[0]).toBe(true);
    } finally {
      getSpy.mockRestore();
      setSpy.mockRestore();
    }
  });
});
