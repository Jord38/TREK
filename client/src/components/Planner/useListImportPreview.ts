import type { ListPreviewPlace, PlaceListCommitRequest, PlaceListPreviewResponse } from '@trek/shared';
import { useMemo, useState } from 'react';

import { countryNamer } from '../../utils/countryName';

export type ListPreviewData = Extract<PlaceListPreviewResponse, { kind: 'list' }>;

export interface ListPreviewCountry {
  code: string | null;
  /** Null for places outside every country: the UI words "Other". */
  name: string | null;
  count: number;
}

const toggled = <T>(set: ReadonlySet<T>, value: T): Set<T> => {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
};

const initialTicks = (preview: ListPreviewData | null) =>
  new Set((preview?.places ?? []).filter((p) => p.bucket === 'new').map((p) => p.key));

/**
 * The choices made over a previewed Google list: which countries are in, which rows
 * are ticked, which near-misses get their pin moved. Builds the commit request from
 * them. Shared by the desktop dialog and the phone sheet.
 */
export function useListImportPreview(preview: ListPreviewData | null, language: string) {
  const [state, setState] = useState(() => ({
    preview,
    selectedCountries: new Set<string | null>(),
    ticked: initialTicks(preview),
    pinMoves: new Set<string>(),
  }));
  let current = state;
  if (state.preview !== preview) {
    current = {
      preview,
      selectedCountries: new Set<string | null>(),
      ticked: initialTicks(preview),
      pinMoves: new Set<string>(),
    };
    setState(current);
  }
  const { selectedCountries, ticked, pinMoves } = current;
  const update = (patch: Partial<Omit<typeof state, 'preview'>>) => setState({ ...current, ...patch });

  const places = useMemo(() => preview?.places ?? [], [preview]);

  const countries = useMemo<ListPreviewCountry[]>(() => {
    const nameOf = countryNamer(language);
    const counts = new Map<string | null, number>();
    for (const p of places) counts.set(p.country, (counts.get(p.country) ?? 0) + 1);
    return [...counts]
      .map(([code, count]) => ({ code, name: code === null ? null : nameOf(code), count }))
      .sort((a, b) => {
        if ((a.code === null) !== (b.code === null)) return a.code === null ? 1 : -1;
        return b.count - a.count || (a.name ?? '').localeCompare(b.name ?? '');
      });
  }, [places, language]);

  const inCountries = places.filter((p) => selectedCountries.has(p.country));

  const rows = {
    new: inCountries.filter((p) => p.bucket === 'new'),
    check: inCountries.filter((p) => p.bucket === 'check' && !pinMoves.has(p.key)),
    existing: inCountries.filter((p) => p.bucket === 'existing' || pinMoves.has(p.key)),
  };

  const counts = {
    inCountries: inCountries.length,
    new: rows.new.length,
    check: rows.check.length,
    existing: rows.existing.length,
    toImport: inCountries.filter((p) => ticked.has(p.key)).length,
  };

  const toggleCountry = (code: string | null) => update({ selectedCountries: toggled(selectedCountries, code) });

  // Ticking a row to import it cancels a pin move on it: it is one or the other.
  const toggle = (key: string) => {
    const nextPins = new Set(pinMoves);
    nextPins.delete(key);
    update({ ticked: toggled(ticked, key), pinMoves: nextPins });
  };

  const togglePinMove = (key: string) => {
    const place = places.find((p) => p.key === key);
    if (!place || place.bucket !== 'check' || !place.match) return;
    const nextTicks = new Set(ticked);
    nextTicks.delete(key);
    update({ pinMoves: toggled(pinMoves, key), ticked: nextTicks });
  };

  const toCommit = (listName: string, enrich: boolean): PlaceListCommitRequest => {
    const toPlace = ({ name, lat, lng, notes, googleFtid }: ListPreviewPlace) => ({
      name,
      lat,
      lng,
      notes,
      googleFtid,
    });
    return {
      listName,
      enrich,
      places: inCountries.filter((p) => ticked.has(p.key)).map(toPlace),
      link: inCountries.flatMap((p) =>
        p.bucket === 'existing' && p.match && p.googleFtid && !ticked.has(p.key)
          ? [{ placeId: p.match.placeId, googleFtid: p.googleFtid }]
          : []
      ),
      movePin: inCountries.flatMap((p) =>
        pinMoves.has(p.key) && p.match
          ? [{ placeId: p.match.placeId, lat: p.lat, lng: p.lng, googleFtid: p.googleFtid }]
          : []
      ),
    };
  };

  return {
    countries,
    selectedCountries,
    toggleCountry,
    rows,
    ticked,
    toggle,
    pinMoves,
    togglePinMove,
    counts,
    toCommit,
  };
}
