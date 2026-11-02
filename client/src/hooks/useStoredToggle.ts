import { useState } from 'react';

/**
 * An on/off switch remembered in localStorage as '1' or '0'. A storage that
 * throws (Safari private mode) still leaves a working switch; it just forgets
 * the choice between reloads.
 */
export function useStoredToggle(key: string): [boolean, () => void] {
  const [on, setOn] = useState<boolean>(() => {
    try {
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setOn((v) => {
      const next = !v;
      try {
        localStorage.setItem(key, next ? '1' : '0');
      } catch {
        /* keep the switch working anyway */
      }
      return next;
    });
  return [on, toggle];
}
