// FE-PLANNER-LISTDIST-001 to FE-PLANNER-LISTDIST-004: distances in the list import preview.
import { describe, expect, it } from 'vitest';

import { formatListDistance } from './formatListDistance';

describe('formatListDistance', () => {
  it('FE-PLANNER-LISTDIST-001: under a kilometre it shows whole metres', () => {
    expect(formatListDistance(9.4, 'en')).toBe('9 m');
    expect(formatListDistance(260, 'en')).toBe('260 m');
  });

  it('FE-PLANNER-LISTDIST-002: from a kilometre it shows kilometres with one decimal', () => {
    expect(formatListDistance(1200, 'en')).toBe('1.2 km');
    expect(formatListDistance(1000, 'en')).toBe('1.0 km');
    expect(formatListDistance(400000, 'en')).toBe('400.0 km');
  });

  it('FE-PLANNER-LISTDIST-003: a distance that rounds up to 1000 m reads as 1.0 km', () => {
    expect(formatListDistance(999.6, 'en')).toBe('1.0 km');
  });

  it('FE-PLANNER-LISTDIST-004: the decimal separator follows the language', () => {
    expect(formatListDistance(1200, 'nl')).toBe('1,2 km');
  });
});
