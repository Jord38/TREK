import type { ListPreviewPlace } from '@trek/shared';
import { ChevronRight } from 'lucide-react';
import { useId, type ReactNode, type Ref } from 'react';

import type { useTranslation } from '../../i18n';
import { fs } from '../shared/DialogShell';
import { matchReason } from './listPreviewReason';
import type { ListPreviewView } from './useListPreviewView';

type Translate = ReturnType<typeof useTranslation>['t'];

interface Props {
  view: ListPreviewView;
  t: Translate;
  language: string;
}

const LINK_BUTTON = 'cursor-pointer border-0 bg-transparent p-0 text-start font-medium text-content underline';
const CHIP = 'inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium ring-1 ring-edge-faint';

function Group({
  title,
  tone,
  hint,
  children,
  collapsed,
  onToggle,
}: {
  title: string;
  tone: 'check' | 'plain';
  hint?: string;
  children: ReactNode;
  /** Set for a group that starts closed: the heading becomes its toggle. */
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const open = !onToggle || !collapsed;
  const frame = tone === 'check' ? 'border-warning bg-warning-soft' : 'border-edge-faint';
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="m-0 font-semibold text-content" style={fs(12.5, 'body')}>
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-[inherit] text-content"
          >
            <ChevronRight
              size={14}
              className={open ? 'rotate-90 rtl:-rotate-90' : 'rtl:rotate-180'}
              aria-hidden="true"
            />
            {title}
          </button>
        ) : (
          title
        )}
      </h3>
      {open && hint && (
        <p className="m-0 text-content-faint" style={fs(11)}>
          {hint}
        </p>
      )}
      {open && (
        <ul className={`m-0 list-none divide-y divide-edge-faint rounded-[12px] border p-0 ${frame}`}>{children}</ul>
      )}
    </section>
  );
}

function Row({
  place,
  checked,
  onToggle,
  t,
  language,
  pinMove,
  onPinMove,
  pinButtonRef,
}: {
  place: ListPreviewPlace;
  checked: boolean;
  onToggle: () => void;
  t: Translate;
  language: string;
  /** The row's existing place gets its pin moved: the reason line says so, with the way back. */
  pinMove: boolean;
  onPinMove: () => void;
  pinButtonRef: Ref<HTMLButtonElement>;
}) {
  const id = useId();
  const reason = pinMove
    ? t('places.listPreview.pinWillMove', { name: place.match?.name ?? '' })
    : matchReason(place, t, language);
  const canMovePin = place.bucket === 'check' && !!place.match && !pinMove;
  const pinLabel = t(pinMove ? 'places.listPreview.keepPin' : 'places.listPreview.usePin');
  return (
    <li className="flex items-start gap-2.5 px-3 py-2">
      <input id={id} type="checkbox" checked={checked} onChange={onToggle} className="mt-0.5 flex-none accent-accent" />
      <div className="min-w-0 flex-1">
        <label
          htmlFor={id}
          className="block cursor-pointer break-words font-medium text-content"
          style={fs(13, 'body')}
        >
          {place.name}
        </label>
        {reason && (
          <div className="mt-0.5 text-content-muted" style={fs(12, 'body')}>
            {reason}
          </div>
        )}
        {(canMovePin || pinMove) && (
          <button
            ref={pinButtonRef}
            type="button"
            onClick={onPinMove}
            aria-label={`${pinLabel}: ${place.name}`}
            className={`${LINK_BUTTON} mt-1`}
            style={fs(12, 'body')}
          >
            {pinLabel}
          </button>
        )}
      </div>
    </li>
  );
}

/** The previewed Google list: country chips, a summary and the three groups of places with their ticks. */
export default function ListImportPreview({ view, t, language }: Props) {
  const { preview, selected, countryName, summary, existingOpen, toggleExisting, rowProps } = view;
  const { countries, selectedCountries, toggleCountry, rows } = preview;

  const renderRows = (places: ListPreviewPlace[]) =>
    places.map((place) => <Row key={place.key} place={place} t={t} language={language} {...rowProps(place)} />);

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label={t('places.listPreview.countries')} className="flex flex-wrap gap-2">
        {countries.map((country) => {
          const on = selectedCountries.has(country.code);
          return (
            <button
              key={country.code ?? 'other'}
              type="button"
              aria-pressed={on}
              onClick={() => toggleCountry(country.code)}
              className={`${CHIP} cursor-pointer ${on ? 'bg-accent text-accent-text' : 'bg-surface-card text-content hover:bg-surface-secondary'}`}
              style={fs(12.5, 'body')}
            >
              {countryName(country.name)}
              <span className={on ? 'opacity-80' : 'text-content-faint'}>{country.count}</span>
            </button>
          );
        })}
      </div>

      {selected.length === 0 ? (
        <p className="m-0 text-content-faint" style={fs(12.5, 'body')}>
          {t('places.listPreview.pickCountry')}
        </p>
      ) : (
        <>
          <p className="m-0 text-content" style={fs(13, 'body')}>
            {summary}
          </p>
          {rows.check.length > 0 && (
            <Group
              title={t('places.listPreview.groupCheck', { total: rows.check.length })}
              tone="check"
              hint={t('places.listPreview.checkHint')}
            >
              {renderRows(rows.check)}
            </Group>
          )}
          {rows.new.length > 0 && (
            <Group title={t('places.listPreview.groupNew', { total: rows.new.length })} tone="plain">
              {renderRows(rows.new)}
            </Group>
          )}
          {rows.existing.length > 0 && (
            <Group
              title={t('places.listPreview.groupExisting', { total: rows.existing.length })}
              tone="plain"
              hint={t('places.listPreview.existingHint')}
              collapsed={!existingOpen}
              onToggle={toggleExisting}
            >
              {renderRows(rows.existing)}
            </Group>
          )}
        </>
      )}
    </div>
  );
}
