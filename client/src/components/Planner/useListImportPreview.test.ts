// FE-PLANNER-LISTPREV-001 to FE-PLANNER-LISTPREV-013: the choices held over a previewed Google list.
import { act, renderHook } from '@testing-library/react';
import { placeListCommitRequestSchema, type ListPreviewPlace, type PlaceListPreviewResponse } from '@trek/shared';
import { describe, expect, it } from 'vitest';

import { useListImportPreview } from './useListImportPreview';

type ListPreview = Extract<PlaceListPreviewResponse, { kind: 'list' }>;

function row(key: string, over: Partial<ListPreviewPlace> = {}): ListPreviewPlace {
  return {
    key,
    name: `Place ${key}`,
    lat: 10,
    lng: 20,
    notes: null,
    googleFtid: `ftid-${key}`,
    country: 'NL',
    bucket: 'new',
    match: null,
    hint: null,
    ...over,
  };
}

const match = (placeId: number) => ({ placeId, name: `Existing ${placeId}`, distanceM: 40, reason: 'name' as const });

function preview(places: ListPreviewPlace[]): ListPreview {
  return { kind: 'list', listName: 'Weekend', places };
}

function setup(places: ListPreviewPlace[]) {
  const data = preview(places);
  return renderHook(() => useListImportPreview(data, 'en'));
}

const sample = () => [
  row('0', { country: 'NL' }),
  row('1', { country: 'NL', bucket: 'check', match: match(11) }),
  row('2', { country: 'NL', bucket: 'existing', match: match(12) }),
  row('3', { country: 'DE' }),
  row('4', { country: null }),
  row('5', { country: null }),
  row('6', { country: null }),
];

describe('useListImportPreview', () => {
  it('FE-PLANNER-LISTPREV-001: countries are named in the language, sorted by count with the null country last', () => {
    const { result } = setup(sample());
    expect(result.current.countries).toEqual([
      { code: 'NL', name: 'Netherlands', count: 3 },
      { code: 'DE', name: 'Germany', count: 1 },
      { code: null, name: null, count: 3 },
    ]);
  });

  it('FE-PLANNER-LISTPREV-002: no country is selected, so no rows and nothing to import', () => {
    const { result } = setup(sample());
    expect(result.current.selectedCountries.size).toBe(0);
    expect(result.current.rows).toEqual({ new: [], check: [], existing: [] });
    expect(result.current.counts).toEqual({ inCountries: 0, new: 0, check: 0, existing: 0, toImport: 0 });
  });

  it('FE-PLANNER-LISTPREV-003: new rows start ticked, check and existing rows unticked, hints never untick', () => {
    const { result } = setup([
      row('0', { hint: { kind: 'next-to', placeId: 5, name: 'Near', distanceM: 20 } }),
      row('1', { bucket: 'check', match: match(11) }),
      row('2', { bucket: 'existing', match: match(12) }),
    ]);
    expect([...result.current.ticked]).toEqual(['0']);
  });

  it('FE-PLANNER-LISTPREV-004: selecting a country shows its rows by bucket and counts them', () => {
    const { result } = setup(sample());
    act(() => result.current.toggleCountry('NL'));
    expect(result.current.rows.new.map((r) => r.key)).toEqual(['0']);
    expect(result.current.rows.check.map((r) => r.key)).toEqual(['1']);
    expect(result.current.rows.existing.map((r) => r.key)).toEqual(['2']);
    expect(result.current.counts).toEqual({ inCountries: 3, new: 1, check: 1, existing: 1, toImport: 1 });
    act(() => result.current.toggleCountry('NL'));
    expect(result.current.counts.inCountries).toBe(0);
  });

  it('FE-PLANNER-LISTPREV-005: toImport follows the ticks', () => {
    const { result } = setup(sample());
    act(() => result.current.toggleCountry('NL'));
    act(() => result.current.toggle('1'));
    expect(result.current.counts.toImport).toBe(2);
    act(() => result.current.toggle('0'));
    expect(result.current.counts.toImport).toBe(1);
    expect(result.current.ticked.has('0')).toBe(false);
  });

  it('FE-PLANNER-LISTPREV-006: a pin move on a check row moves it to existing and is reversible', () => {
    const { result } = setup(sample());
    act(() => result.current.toggleCountry('NL'));
    act(() => result.current.togglePinMove('1'));
    expect(result.current.pinMoves.has('1')).toBe(true);
    expect(result.current.rows.check).toEqual([]);
    expect(result.current.rows.existing.map((r) => r.key)).toEqual(['1', '2']);
    expect(result.current.counts).toMatchObject({ check: 0, existing: 2 });
    act(() => result.current.togglePinMove('1'));
    expect(result.current.rows.check.map((r) => r.key)).toEqual(['1']);
  });

  it('FE-PLANNER-LISTPREV-007: a pin move is offered only on a check row with a match', () => {
    const { result } = setup(sample());
    act(() => result.current.toggleCountry('NL'));
    act(() => result.current.togglePinMove('0'));
    act(() => result.current.togglePinMove('2'));
    expect(result.current.pinMoves.size).toBe(0);
  });

  it('FE-PLANNER-LISTPREV-008: toCommit sends ticked rows as places, untouched existing matches as links, pin moves as movePin', () => {
    const { result } = setup(sample());
    act(() => result.current.toggleCountry('NL'));
    act(() => result.current.togglePinMove('1'));
    expect(result.current.toCommit('Weekend', true)).toEqual({
      listName: 'Weekend',
      enrich: true,
      places: [{ name: 'Place 0', lat: 10, lng: 20, notes: null, googleFtid: 'ftid-0' }],
      link: [{ placeId: 12, googleFtid: 'ftid-2' }],
      movePin: [{ placeId: 11, lat: 10, lng: 20, googleFtid: 'ftid-1' }],
    });
  });

  it('FE-PLANNER-LISTPREV-009: a ticked existing row is imported and not linked', () => {
    const { result } = setup(sample());
    act(() => result.current.toggleCountry('NL'));
    act(() => result.current.toggle('2'));
    const request = result.current.toCommit('Weekend', false);
    expect(request.places.map((p) => p.name)).toEqual(['Place 0', 'Place 2']);
    expect(request.link).toEqual([]);
  });

  it('FE-PLANNER-LISTPREV-010: an existing match without a Google id is not linked', () => {
    const { result } = setup([row('0', { bucket: 'existing', match: match(12), googleFtid: null })]);
    act(() => result.current.toggleCountry('NL'));
    expect(result.current.toCommit('L', false).link).toEqual([]);
  });

  it('FE-PLANNER-LISTPREV-011: switching a country off drops its rows from the commit', () => {
    const { result } = setup(sample());
    act(() => result.current.toggleCountry('NL'));
    act(() => result.current.toggleCountry('DE'));
    expect(result.current.toCommit('L', false).places.map((p) => p.name)).toEqual(['Place 0', 'Place 3']);
    act(() => result.current.toggleCountry('NL'));
    const request = result.current.toCommit('L', false);
    expect(request.places.map((p) => p.name)).toEqual(['Place 3']);
    expect(request.link).toEqual([]);
  });

  it('FE-PLANNER-LISTPREV-012: without a preview everything is empty', () => {
    const { result } = renderHook(() => useListImportPreview(null, 'en'));
    expect(result.current.countries).toEqual([]);
    expect(result.current.counts.inCountries).toBe(0);
  });

  it('FE-PLANNER-LISTPREV-013: toCommit cuts a name, note or list name to what the commit route accepts', () => {
    const { result } = setup([row('0', { name: 'N'.repeat(250), notes: 'x'.repeat(2500) })]);
    act(() => result.current.toggleCountry('NL'));
    const request = result.current.toCommit('L'.repeat(300), false);
    expect(request.listName).toHaveLength(200);
    expect(request.places[0].name).toHaveLength(200);
    expect(request.places[0].notes).toHaveLength(2000);
    expect(placeListCommitRequestSchema.safeParse(request).success).toBe(true);
  });
});
