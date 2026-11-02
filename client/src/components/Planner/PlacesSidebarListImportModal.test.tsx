// FE-PLANNER-LISTMODAL-001 to FE-PLANNER-LISTMODAL-010: the desktop list import dialog around the preview.
import type { ListPreviewPlace } from '@trek/shared';
import { fireEvent, render, screen } from '../../../tests/helpers/render';
import { useTranslation } from '../../i18n';
import { ListImportModal } from './PlacesSidebarListImportModal';
import type { ListPreviewData } from './useListImportPreview';
import type { SidebarState } from './usePlacesSidebar';

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

const existing = (key: string) =>
  row(key, {
    bucket: 'existing',
    match: { placeId: 40 + Number(key), name: 'Trip place', distanceM: 20, reason: 'name' },
  });

const data = (places: ListPreviewPlace[]): ListPreviewData => ({ kind: 'list', listName: 'Weekend', places });

const handlers = () => ({
  closeListImport: vi.fn(),
  handleListImport: vi.fn(),
  handleListCommit: vi.fn(),
  backToLink: vi.fn(),
  setListImportUrl: vi.fn(),
});

function Host({ over = {}, fns }: { over?: Partial<SidebarState>; fns: ReturnType<typeof handlers> }) {
  const { t, language } = useTranslation();
  const S = {
    t,
    language,
    ...fns,
    listImportUrl: 'https://maps.app.goo.gl/x',
    listImportLoading: false,
    listImportProvider: 'google',
    setListImportProvider: vi.fn(),
    hasMultipleListImportProviders: false,
    availableListImportProviders: ['google'],
    listImportEnrich: false,
    setListImportEnrich: vi.fn(),
    canEnrichImport: false,
    listImportPreview: null,
    ...over,
  } as unknown as SidebarState;
  return <ListImportModal {...S} />;
}

const importBtn = (name: RegExp | string = /^Import/) => screen.getByRole('button', { name });
const pickNl = () => fireEvent.click(screen.getByRole('button', { name: /Netherlands/ }));

describe('ListImportModal', () => {
  it('FE-PLANNER-LISTMODAL-001: without a preview it shows the link form, and Import previews the link', () => {
    const fns = handlers();
    render(<Host fns={fns} />);
    expect(screen.getByPlaceholderText('https://maps.app.goo.gl/...')).toBeInTheDocument();
    fireEvent.click(importBtn('Import'));
    expect(fns.handleListImport).toHaveBeenCalledTimes(1);
  });

  it('FE-PLANNER-LISTMODAL-002: with a preview it shows the list instead of the link form', () => {
    render(<Host fns={handlers()} over={{ listImportPreview: data([row('0'), row('1')]) }} />);
    expect(screen.queryByPlaceholderText('https://maps.app.goo.gl/...')).not.toBeInTheDocument();
    expect(screen.getByText('Weekend · 2 places')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Netherlands/ })).toBeInTheDocument();
  });

  it('FE-PLANNER-LISTMODAL-003: Import is disabled until a country is picked, then shows the count', () => {
    render(<Host fns={handlers()} over={{ listImportPreview: data([row('0'), row('1'), existing('2')]) }} />);
    expect(importBtn()).toBeDisabled();
    pickNl();
    expect(importBtn('Import 2 places')).toBeEnabled();
  });

  it('FE-PLANNER-LISTMODAL-004: the count follows the ticks, and singular reads right', () => {
    render(<Host fns={handlers()} over={{ listImportPreview: data([row('0'), row('1')]) }} />);
    pickNl();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Place 1' }));
    expect(importBtn('Import 1 place')).toBeEnabled();
  });

  it('FE-PLANNER-LISTMODAL-005: with every row unticked and nothing to link, Import is disabled', () => {
    render(<Host fns={handlers()} over={{ listImportPreview: data([row('0')]) }} />);
    pickNl();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Place 0' }));
    expect(importBtn('Import')).toBeDisabled();
  });

  it('FE-PLANNER-LISTMODAL-006: matches to link keep Import enabled with nothing ticked', () => {
    render(<Host fns={handlers()} over={{ listImportPreview: data([existing('0')]) }} />);
    pickNl();
    expect(importBtn('Import')).toBeEnabled();
  });

  it('FE-PLANNER-LISTMODAL-007: Import sends the request built from the ticks and the enrich choice', () => {
    const fns = handlers();
    render(<Host fns={fns} over={{ listImportPreview: data([row('0'), existing('1')]), listImportEnrich: true }} />);
    pickNl();
    fireEvent.click(importBtn('Import 1 place'));
    expect(fns.handleListCommit).toHaveBeenCalledTimes(1);
    const request = fns.handleListCommit.mock.calls[0][0];
    expect(request.listName).toBe('Weekend');
    expect(request.enrich).toBe(true);
    expect(request.places).toHaveLength(1);
    expect(request.link).toEqual([{ placeId: 41, googleFtid: 'ftid-1' }]);
  });

  it('FE-PLANNER-LISTMODAL-008: Import is disabled while loading', () => {
    render(<Host fns={handlers()} over={{ listImportPreview: data([row('0')]), listImportLoading: true }} />);
    pickNl();
    expect(screen.getByRole('button', { name: /Loading/ })).toBeDisabled();
  });

  it('FE-PLANNER-LISTMODAL-009: Cancel closes through the hook without a commit', () => {
    const fns = handlers();
    render(<Host fns={fns} over={{ listImportPreview: data([row('0')]) }} />);
    pickNl();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(fns.closeListImport).toHaveBeenCalledTimes(1);
    expect(fns.handleListCommit).not.toHaveBeenCalled();
  });

  it('FE-PLANNER-LISTMODAL-010: Back returns to the link form step', () => {
    const fns = handlers();
    render(<Host fns={fns} over={{ listImportPreview: data([row('0')]) }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(fns.backToLink).toHaveBeenCalledTimes(1);
  });
});
