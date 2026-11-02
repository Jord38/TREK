// FE-PLANNER-LISTVIEW-001 to FE-PLANNER-LISTVIEW-013: the previewed Google list in the import dialog.
import type { ListPreviewPlace } from '@trek/shared';
import { fireEvent, render, screen, within } from '../../../tests/helpers/render';
import { useTranslation } from '../../i18n';
import ListImportPreview from './ListImportPreview';
import type { ListPreviewData } from './useListImportPreview';
import { useListPreviewView } from './useListPreviewView';

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

const places = [
  row('0', { name: 'Windmill Bar' }),
  row('1', {
    name: 'Canal Lounge',
    bucket: 'check',
    match: { placeId: 11, name: 'Canal Lounge Centrum', distanceM: 1200, reason: 'core-far' },
  }),
  row('2', {
    name: 'Harbour Pier',
    bucket: 'existing',
    match: { placeId: 12, name: 'HARBOUR PIER', distanceM: 260, reason: 'name' },
  }),
  row('3', {
    name: 'Tulip Hall',
    bucket: 'new',
    hint: { kind: 'same-name-far', placeId: 13, name: 'Tulip Hall', distanceM: 400000 },
  }),
  row('4', { name: 'Black Forest Hut', country: 'DE' }),
  row('5', { name: 'Odd Spot', country: null }),
  row('6', { name: 'Lone Check', bucket: 'check', match: null }),
  row('7', {
    name: 'Round Two Arena Annex',
    bucket: 'new',
    hint: { kind: 'similar-nearby', placeId: 14, name: 'Round Two', distanceM: 200 },
  }),
];
const data: ListPreviewData = { kind: 'list', listName: 'Weekend', places };

function Harness() {
  const { t, language } = useTranslation();
  const view = useListPreviewView(data, language, t, { enrich: false, loading: false });
  return <ListImportPreview view={view} t={t} language={language} />;
}

const chip = (name: RegExp) => screen.getByRole('button', { name });
const select = (name: RegExp) => fireEvent.click(chip(name));
const headings = () => screen.getAllByRole('heading').map((h) => h.textContent);

describe('ListImportPreview', () => {
  it('FE-PLANNER-LISTVIEW-001: country chips show the name and count, no country is selected', () => {
    render(<Harness />);
    expect(chip(/Netherlands/)).toHaveTextContent('6');
    expect(chip(/Germany/)).toHaveTextContent('1');
    expect(chip(/Other/)).toHaveTextContent('1');
    expect(chip(/Netherlands/)).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('Windmill Bar')).not.toBeInTheDocument();
  });

  it('FE-PLANNER-LISTVIEW-002: a chip toggles its country on and off', () => {
    render(<Harness />);
    select(/Germany/);
    expect(chip(/Germany/)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Black Forest Hut')).toBeInTheDocument();
    select(/Germany/);
    expect(screen.queryByText('Black Forest Hut')).not.toBeInTheDocument();
  });

  it('FE-PLANNER-LISTVIEW-003: the summary reads the counts for one country', () => {
    render(<Harness />);
    select(/Netherlands/);
    expect(screen.getByText('6 in Netherlands · 3 new · 1 already in your trip · 2 to check')).toBeInTheDocument();
  });

  it('FE-PLANNER-LISTVIEW-004: with several countries the summary names how many, not each', () => {
    render(<Harness />);
    select(/Netherlands/);
    select(/Germany/);
    expect(screen.getByText('7 in 2 countries · 4 new · 1 already in your trip · 2 to check')).toBeInTheDocument();
  });

  it('FE-PLANNER-LISTVIEW-005: the groups come as To check, New, Already in your trip', () => {
    render(<Harness />);
    select(/Netherlands/);
    expect(headings()).toEqual(['To check · 2', 'New · 3', 'Already in your trip · 1']);
  });

  it('FE-PLANNER-LISTVIEW-006: Already in your trip stays collapsed until opened', () => {
    render(<Harness />);
    select(/Netherlands/);
    const toggle = screen.getByRole('button', { name: /Already in your trip/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Harbour Pier')).not.toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.getByText('Harbour Pier')).toBeInTheDocument();
  });

  it('FE-PLANNER-LISTVIEW-007: new rows start ticked and a row checkbox toggles', () => {
    render(<Harness />);
    select(/Netherlands/);
    const box = screen.getByRole('checkbox', { name: 'Windmill Bar' });
    expect(box).toBeChecked();
    fireEvent.click(box);
    expect(box).not.toBeChecked();
    const check = screen.getByRole('checkbox', { name: 'Canal Lounge' });
    expect(check).not.toBeChecked();
    fireEvent.click(check);
    expect(check).toBeChecked();
  });

  it('FE-PLANNER-LISTVIEW-008: a match reason names the trip place and the distance', () => {
    render(<Harness />);
    select(/Netherlands/);
    expect(screen.getByText(/Same name as your "Canal Lounge Centrum", 1\.2 km apart/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Already in your trip/ }));
    expect(screen.getByText('Matches your "HARBOUR PIER" · 260 m')).toBeInTheDocument();
  });

  it('FE-PLANNER-LISTVIEW-009: a hint names the trip place and the distance, no city', () => {
    render(<Harness />);
    select(/Netherlands/);
    expect(screen.getByText('Your trip has a "Tulip Hall", 400.0 km away. A different place?')).toBeInTheDocument();
  });

  it('FE-PLANNER-LISTVIEW-010: the pin action shows only on to-check rows that have a match, named after the place', () => {
    render(<Harness />);
    select(/Netherlands/);
    expect(screen.getAllByRole('button', { name: /^Use Google's location for mine/ })).toHaveLength(1);
    const withMatch = screen.getByText('Canal Lounge').closest('li') as HTMLElement;
    expect(
      within(withMatch).getByRole('button', { name: "Use Google's location for mine: Canal Lounge" })
    ).toBeInTheDocument();
    const withoutMatch = screen.getByText('Lone Check').closest('li') as HTMLElement;
    expect(within(withoutMatch).queryByRole('button')).not.toBeInTheDocument();
  });

  it("FE-PLANNER-LISTVIEW-011: using Google's location moves the row into an opened Already group with focus on its way back", () => {
    render(<Harness />);
    select(/Netherlands/);
    fireEvent.click(screen.getByRole('button', { name: "Use Google's location for mine: Canal Lounge" }));
    expect(headings()).toEqual(['To check · 1', 'New · 3', 'Already in your trip · 2']);
    expect(screen.getByRole('button', { name: /Already in your trip/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Your pin "Canal Lounge Centrum" will move to Google\'s location.')).toBeInTheDocument();
    const keep = screen.getByRole('button', { name: 'Keep my pin: Canal Lounge' });
    expect(keep).toHaveFocus();
    fireEvent.click(keep);
    expect(headings()).toEqual(['To check · 2', 'New · 3', 'Already in your trip · 1']);
    expect(screen.getByRole('button', { name: "Use Google's location for mine: Canal Lounge" })).toHaveFocus();
  });

  it('FE-PLANNER-LISTVIEW-012: with no country selected it asks to pick one', () => {
    render(<Harness />);
    expect(screen.getByText('Pick a country to see its places.')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('FE-PLANNER-LISTVIEW-013: a similar name nearby is a new row with its own hint', () => {
    render(<Harness />);
    select(/Netherlands/);
    expect(screen.getByText('Similar name to your "Round Two", 200 m away. A different place?')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Round Two Arena Annex' })).toBeChecked();
  });
});
