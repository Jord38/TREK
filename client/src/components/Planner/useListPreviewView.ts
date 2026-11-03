import type { ListPreviewPlace } from '@trek/shared';
import { useRef, useState } from 'react';

import type { useTranslation } from '../../i18n';
import { useListImportPreview, type ListPreviewData } from './useListImportPreview';

type Translate = ReturnType<typeof useTranslation>['t'];

interface SubmitState {
  enrich: boolean;
  loading: boolean;
}

/**
 * What the desktop dialog and the phone sheet show over a previewed Google list besides
 * the ticks: the summary line, the Already group's disclosure, where focus goes after a
 * pin move, and what Import sends and how its button reads.
 */
export function useListPreviewView(
  data: ListPreviewData | null,
  language: string,
  t: Translate,
  { enrich, loading }: SubmitState
) {
  const preview = useListImportPreview(data, language);
  const { countries, selectedCountries, counts, pinMoves, togglePinMove } = preview;

  const [disclosure, setDisclosure] = useState({ data, existingOpen: false });
  const existingOpen = disclosure.data === data && disclosure.existingOpen;
  const setExistingOpen = (open: boolean) => setDisclosure({ data, existingOpen: open });
  const focusPinOf = useRef<string | null>(null);

  const countryName = (name: string | null) => name ?? t('places.listPreview.other');
  const selected = countries.filter((c) => selectedCountries.has(c.code));
  const summary = [
    selected.length === 1
      ? t('places.listPreview.inCountry', { total: counts.inCountries, country: countryName(selected[0].name) })
      : t('places.listPreview.inCountries', { places: counts.inCountries, count: selected.length }),
    t('places.listPreview.summaryNew', { total: counts.new }),
    t('places.listPreview.summaryExisting', { total: counts.existing }),
    t('places.listPreview.summaryCheck', { total: counts.check }),
  ].join(' · ');

  // A moved pin takes its row from To check into the Already group: open it, and hand
  // focus to the row's button in its new place so keyboard and screen reader users follow.
  const movePin = (key: string) => {
    if (!pinMoves.has(key)) setExistingOpen(true);
    focusPinOf.current = key;
    togglePinMove(key);
  };
  const pinButtonRef = (key: string) => (button: HTMLButtonElement | null) => {
    if (!button || focusPinOf.current !== key) return;
    focusPinOf.current = null;
    button.focus();
  };

  /** The tick and pin-move wiring of one row, the same on both views. */
  const rowProps = (place: ListPreviewPlace) => ({
    checked: preview.ticked.has(place.key),
    onToggle: () => preview.toggle(place.key),
    pinMove: pinMoves.has(place.key),
    onPinMove: () => movePin(place.key),
    pinButtonRef: pinButtonRef(place.key),
  });

  const commit = preview.toCommit(data?.listName ?? '', enrich);
  // A link-only commit (ids to attach, pins to move) is a valid import with no place ticked.
  const nothingToCommit = counts.toImport === 0 && commit.link.length === 0 && commit.movePin.length === 0;
  const submitLabel = loading
    ? t('common.loading')
    : counts.toImport > 0
      ? t('places.listPreview.import', { count: counts.toImport })
      : t('common.import');

  return {
    preview,
    selected,
    countryName,
    summary,
    existingOpen,
    toggleExisting: () => setExistingOpen(!existingOpen),
    rowProps,
    commit,
    submitDisabled: loading || nothingToCommit,
    submitLabel,
  };
}

export type ListPreviewView = ReturnType<typeof useListPreviewView>;
