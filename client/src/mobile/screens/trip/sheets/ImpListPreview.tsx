import type { ListPreviewPlace } from '@trek/shared';
import { ChevronRight } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { matchReason } from '../../../../components/Planner/listPreviewReason';
import type { useListImport } from '../../../../components/Planner/useListImport';
import { useListImportPreview, type ListPreviewData } from '../../../../components/Planner/useListImportPreview';
import MChip from '../../../components/MChip';
import type { TripPlanner } from '../MTripShell';
import { FormSheetFooter } from './PlSheetChrome';

type Translate = TripPlanner['t'];
type Preview = ReturnType<typeof useListImportPreview>;
type Commit = ReturnType<typeof useListImport>['handleCommit'];

function Group({
  title,
  warn,
  hint,
  children,
  collapsed,
  onToggle,
}: {
  title: string;
  warn?: boolean;
  hint?: string;
  children: ReactNode;
  /** Set for a group that starts closed: the heading becomes its toggle. */
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const open = !onToggle || !collapsed;
  return (
    <section className="flex flex-col gap-[6px]">
      <h3 className="m-0 text-body font-semibold text-m-ink">
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="inline-flex items-center gap-1 font-[inherit] text-m-ink"
          >
            <ChevronRight
              size={14}
              aria-hidden="true"
              className={open ? 'rotate-90 rtl:-rotate-90' : 'rtl:rotate-180'}
            />
            {title}
          </button>
        ) : (
          title
        )}
      </h3>
      {open && hint && <p className="m-0 font-geist text-caption leading-[1.4] text-m-faint">{hint}</p>}
      {open && (
        <ul
          className={`m-0 list-none divide-y divide-[color:var(--m-rowbr)] rounded-[12px] border p-0 ${
            warn ? 'border-[color:var(--m-st-pending)]' : 'border-[color:var(--m-rowbr)]'
          }`}
        >
          {children}
        </ul>
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
}: {
  place: ListPreviewPlace;
  checked: boolean;
  onToggle: () => void;
  t: Translate;
  language: string;
  pinMove: boolean;
  onPinMove: () => void;
}) {
  const id = useId();
  const reason = pinMove
    ? t('places.listPreview.pinWillMove', { name: place.match?.name ?? '' })
    : matchReason(place, t, language);
  const canMovePin = place.bucket === 'check' && !!place.match && !pinMove;
  const pinLabel = t(pinMove ? 'places.listPreview.keepPin' : 'places.listPreview.usePin');
  return (
    <li className="flex items-start gap-3 px-3 py-[10px]">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-[2px] h-[18px] w-[18px] flex-none accent-[color:var(--m-act)]"
      />
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block break-words text-body font-semibold text-m-ink">
          {place.name}
        </label>
        {reason && <div className="mt-[2px] font-geist text-caption leading-[1.4] text-m-muted">{reason}</div>}
        {(canMovePin || pinMove) && (
          <button
            type="button"
            onClick={onPinMove}
            aria-label={`${pinLabel}: ${place.name}`}
            className="mt-1 py-1 text-start text-caption font-semibold text-m-ink underline"
          >
            {pinLabel}
          </button>
        )}
      </div>
    </li>
  );
}

function PreviewBody({ preview, t, language }: { preview: Preview; t: Translate; language: string }) {
  const [existingOpen, setExistingOpen] = useState(false);
  const { countries, selectedCountries, toggleCountry, rows, ticked, toggle, pinMoves, togglePinMove, counts } =
    preview;
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

  // A moved pin leaves "To check" for the Already group: open it so the row stays in sight.
  const movePin = (key: string) => {
    if (!pinMoves.has(key)) setExistingOpen(true);
    togglePinMove(key);
  };
  const renderRows = (places: ListPreviewPlace[]) =>
    places.map((place) => (
      <Row
        key={place.key}
        place={place}
        checked={ticked.has(place.key)}
        onToggle={() => toggle(place.key)}
        t={t}
        language={language}
        pinMove={pinMoves.has(place.key)}
        onPinMove={() => movePin(place.key)}
      />
    ));

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label={t('places.listPreview.countries')} className="flex flex-wrap gap-[6px]">
        {countries.map((country) => (
          <MChip
            key={country.code ?? 'other'}
            pressable
            active={selectedCountries.has(country.code)}
            onClick={() => toggleCountry(country.code)}
          >
            {countryName(country.name)}
            <span className="opacity-70">{country.count}</span>
          </MChip>
        ))}
      </div>

      {selected.length === 0 ? (
        <p className="m-0 font-geist text-caption text-m-faint">{t('places.listPreview.pickCountry')}</p>
      ) : (
        <>
          <p className="m-0 text-body text-m-ink">{summary}</p>
          {rows.check.length > 0 && (
            <Group
              warn
              title={t('places.listPreview.groupCheck', { total: rows.check.length })}
              hint={t('places.listPreview.checkHint')}
            >
              {renderRows(rows.check)}
            </Group>
          )}
          {rows.new.length > 0 && (
            <Group title={t('places.listPreview.groupNew', { total: rows.new.length })}>{renderRows(rows.new)}</Group>
          )}
          {rows.existing.length > 0 && (
            <Group
              title={t('places.listPreview.groupExisting', { total: rows.existing.length })}
              hint={t('places.listPreview.existingHint')}
              collapsed={!existingOpen}
              onToggle={() => setExistingOpen(!existingOpen)}
            >
              {renderRows(rows.existing)}
            </Group>
          )}
        </>
      )}
    </div>
  );
}

interface ImpListPreviewProps {
  data: ListPreviewData;
  t: Translate;
  language: string;
  enrich: boolean;
  loading: boolean;
  onBack: () => void;
  onCommit: Commit;
  /** The enrichment switch, shown under the list. */
  children?: ReactNode;
}

/** The previewed Google list on the phone: the same choices as the desktop dialog, over the same hook. */
export default function ImpListPreview({
  data,
  t,
  language,
  enrich,
  loading,
  onBack,
  onCommit,
  children,
}: ImpListPreviewProps) {
  const preview = useListImportPreview(data, language);
  const commit = preview.toCommit(data.listName, enrich);
  // A link-only commit (ids to attach, pins to move) is a valid import with no place ticked.
  const nothingToCommit = preview.counts.toImport === 0 && commit.link.length === 0 && commit.movePin.length === 0;
  const submitLabel = loading
    ? t('common.loading')
    : preview.counts.toImport > 0
      ? t('places.listPreview.import', { count: preview.counts.toImport })
      : t('common.import');

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-[18px] pb-3 pt-1">
        <p className="m-0 text-body font-semibold text-m-ink">
          {t('places.listPreview.listInfo', { list: data.listName, count: data.places.length })}
        </p>
        <PreviewBody preview={preview} t={t} language={language} />
        {children}
      </div>
      <FormSheetFooter
        onCancel={onBack}
        cancelLabel={t('common.back')}
        onSubmit={() => void onCommit(commit)}
        submitLabel={submitLabel}
        submitDisabled={loading || nothingToCommit}
      />
    </>
  );
}
