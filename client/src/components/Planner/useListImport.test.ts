// FE-PLANNER-LISTIMP-001 to FE-PLANNER-LISTIMP-026: the shared-list import logic behind
// the desktop dialog (no onDone) and the phone's import step (onDone).
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetAllStores, seedStore } from '../../../tests/helpers/store';
import { placesApi } from '../../api/client';
import { placeListImportApi } from '../../api/placeListImport';
import { useAuthStore } from '../../store/authStore';
import { useListImport, type ListImportOptions } from './useListImport';

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key}:${Object.values(params).join(',')}` : key;

function setup(over: Partial<ListImportOptions> = {}) {
  const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const loadTrip = vi.fn(async (_tripId: number) => undefined);
  const pushUndo = vi.fn((_label: string, _undo: () => Promise<void> | void) => {});
  const options: ListImportOptions = { tripId: 1, t, toast, loadTrip, pushUndo, ...over };
  const hook = renderHook(() => useListImport(options));
  return { ...hook, toast, loadTrip, pushUndo };
}

async function importUrl(result: { current: ReturnType<typeof useListImport> }, url: string) {
  act(() => result.current.setUrl(url));
  await act(async () => {
    await result.current.handleImport();
  });
}

beforeEach(() => {
  resetAllStores();
  // Google lists go through the preview first; a directions answer is today's direct import.
  vi.spyOn(placeListImportApi, 'previewGoogleList').mockResolvedValue({ kind: 'directions' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useListImport', () => {
  it('FE-PLANNER-LISTIMP-001: starts closed, on Google, with an empty link and enrichment off', () => {
    const { result } = setup();
    expect(result.current.open).toBe(false);
    expect(result.current.provider).toBe('google');
    expect(result.current.url).toBe('');
    expect(result.current.enrich).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.canEnrich).toBe(false);
  });

  it('FE-PLANNER-LISTIMP-002: an empty or blank link starts nothing', async () => {
    const google = vi.spyOn(placesApi, 'importGoogleList');
    const { result, loadTrip } = setup();
    await importUrl(result, '   ');
    expect(google).not.toHaveBeenCalled();
    expect(loadTrip).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it('FE-PLANNER-LISTIMP-003: the desktop dialog imports the trimmed link, reloads, toasts, closes and clears', async () => {
    const google = vi
      .spyOn(placesApi, 'importGoogleList')
      .mockResolvedValue({ count: 2, skipped: 0, listName: 'Tokyo', places: [{ id: 20 }, { id: 21 }] });
    const { result, toast, loadTrip, pushUndo } = setup();
    act(() => result.current.setOpen(true));

    await importUrl(result, ' https://maps.app.goo.gl/abc ');

    expect(google).toHaveBeenCalledWith(1, 'https://maps.app.goo.gl/abc', false);
    expect(loadTrip).toHaveBeenCalledWith(1);
    expect(toast.success).toHaveBeenCalledWith('places.googleListImported:2,Tokyo');
    expect(pushUndo).toHaveBeenCalledWith('undo.importGoogleList', expect.any(Function));
    expect(result.current.open).toBe(false);
    expect(result.current.url).toBe('');
    expect(result.current.loading).toBe(false);
  });

  it('FE-PLANNER-LISTIMP-004: the desktop dialog is closed before the undo step goes in', async () => {
    vi.spyOn(placesApi, 'importGoogleList').mockResolvedValue({
      count: 1,
      skipped: 0,
      listName: 'L',
      places: [{ id: 7 }],
    });
    const { result, toast, pushUndo } = setup();
    pushUndo.mockImplementation(() => {
      throw new Error('history full');
    });
    act(() => result.current.setOpen(true));

    await importUrl(result, 'https://maps.app.goo.gl/abc');

    // The close ran before the throwing undo step, so it stands.
    expect(result.current.open).toBe(false);
    expect(result.current.url).toBe('');
    expect(toast.error).toHaveBeenCalledWith('places.googleListError');
  });

  it('FE-PLANNER-LISTIMP-005: the phone step hands over through onDone after the undo step and keeps its link', async () => {
    vi.spyOn(placesApi, 'importGoogleList').mockResolvedValue({
      count: 1,
      skipped: 0,
      listName: 'L',
      places: [{ id: 7 }],
    });
    const onDone = vi.fn();
    const { result, pushUndo } = setup({ onDone });
    act(() => result.current.setOpen(true));

    await importUrl(result, 'https://maps.app.goo.gl/abc');

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(pushUndo.mock.invocationCallOrder[0]).toBeLessThan(onDone.mock.invocationCallOrder[0]);
    expect(result.current.url).toBe('https://maps.app.goo.gl/abc');
    expect(result.current.open).toBe(true);
  });

  it('FE-PLANNER-LISTIMP-006: the undo step bulk-deletes the imported places and reloads, even when the delete fails', async () => {
    vi.spyOn(placesApi, 'importGoogleList').mockResolvedValue({
      count: 2,
      skipped: 0,
      listName: 'L',
      places: [{ id: 71 }, { id: 72 }],
    });
    const bulkDelete = vi
      .spyOn(placesApi, 'bulkDelete')
      .mockResolvedValueOnce({ deleted: 2 })
      .mockRejectedValueOnce(new Error('gone'));
    const { result, loadTrip, pushUndo } = setup();
    await importUrl(result, 'https://maps.app.goo.gl/abc');

    const revert = pushUndo.mock.calls[0][1] as () => Promise<void>;
    await revert();
    expect(bulkDelete).toHaveBeenCalledWith(1, [71, 72]);
    expect(loadTrip).toHaveBeenCalledTimes(2);

    await expect(revert()).resolves.toBeUndefined();
    expect(loadTrip).toHaveBeenCalledTimes(3);
  });

  it('FE-PLANNER-LISTIMP-007: nothing created means no undo step, and an all-skipped import warns', async () => {
    vi.spyOn(placesApi, 'importGoogleList').mockResolvedValue({ count: 0, skipped: 4, listName: 'L', places: [] });
    const { result, toast, pushUndo } = setup();
    await importUrl(result, 'https://maps.app.goo.gl/abc');
    expect(toast.warning).toHaveBeenCalledWith('places.importAllSkipped');
    expect(toast.success).not.toHaveBeenCalled();
    expect(pushUndo).not.toHaveBeenCalled();
  });

  it('FE-PLANNER-LISTIMP-008: Naver goes to its own endpoint with its own toast and undo label', async () => {
    const naver = vi
      .spyOn(placesApi, 'importNaverList')
      .mockResolvedValue({ count: 2, skipped: 0, listName: 'Seoul', places: [{ id: 81 }] });
    const { result, toast, pushUndo } = setup();
    act(() => result.current.setProvider('naver'));
    await importUrl(result, 'https://naver.me/xyz');
    expect(naver).toHaveBeenCalledWith(1, 'https://naver.me/xyz', false);
    expect(toast.success).toHaveBeenCalledWith('places.naverListImported:2,Seoul');
    expect(pushUndo).toHaveBeenCalledWith('undo.importNaverList', expect.any(Function));
  });

  it('FE-PLANNER-LISTIMP-009: enrichment is sent only when asked for and a maps key exists', async () => {
    const google = vi.spyOn(placesApi, 'importGoogleList').mockResolvedValue({ count: 1, skipped: 0, places: [] });
    const first = setup();
    act(() => first.result.current.setEnrich(true));
    await importUrl(first.result, 'https://maps.app.goo.gl/a');
    expect(google).toHaveBeenLastCalledWith(1, 'https://maps.app.goo.gl/a', false);
    first.unmount();

    seedStore(useAuthStore, { hasMapsKey: true });
    const second = setup();
    expect(second.result.current.canEnrich).toBe(true);
    await importUrl(second.result, 'https://maps.app.goo.gl/b');
    expect(google).toHaveBeenLastCalledWith(1, 'https://maps.app.goo.gl/b', false);
    act(() => second.result.current.setEnrich(true));
    await importUrl(second.result, 'https://maps.app.goo.gl/c');
    expect(google).toHaveBeenLastCalledWith(1, 'https://maps.app.goo.gl/c', true);
  });

  it('FE-PLANNER-LISTIMP-010: a failure shows the server message and leaves the dialog open with its link', async () => {
    vi.spyOn(placesApi, 'importGoogleList').mockRejectedValue({ response: { data: { error: 'List is private' } } });
    const onDone = vi.fn();
    const { result, toast, loadTrip } = setup({ onDone });
    act(() => result.current.setOpen(true));
    await importUrl(result, 'https://maps.app.goo.gl/abc');
    expect(toast.error).toHaveBeenCalledWith('List is private');
    expect(onDone).not.toHaveBeenCalled();
    expect(loadTrip).not.toHaveBeenCalled();
    expect(result.current.open).toBe(true);
    expect(result.current.url).toBe('https://maps.app.goo.gl/abc');
    expect(result.current.loading).toBe(false);
  });

  it('FE-PLANNER-LISTIMP-011: without a server message the provider error key is shown', async () => {
    vi.spyOn(placesApi, 'importGoogleList').mockRejectedValue(new Error('network'));
    vi.spyOn(placesApi, 'importNaverList').mockRejectedValue(new Error('network'));
    const { result, toast } = setup();
    await importUrl(result, 'https://maps.app.goo.gl/abc');
    expect(toast.error).toHaveBeenLastCalledWith('places.googleListError');
    act(() => result.current.setProvider('naver'));
    await importUrl(result, 'https://naver.me/xyz');
    expect(toast.error).toHaveBeenLastCalledWith('places.naverListError');
  });

  it('FE-PLANNER-LISTIMP-012: on the phone a second import while one is in flight is refused', async () => {
    let release: (value: unknown) => void = () => {};
    const google = vi.spyOn(placesApi, 'importGoogleList').mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      })
    );
    const onDone = vi.fn();
    const { result } = setup({ onDone });
    act(() => result.current.setUrl('https://maps.app.goo.gl/abc'));

    let first!: Promise<void>;
    act(() => {
      first = result.current.handleImport();
    });
    expect(result.current.loading).toBe(true);
    await act(async () => {
      await result.current.handleImport();
    });
    expect(google).toHaveBeenCalledTimes(1);

    await act(async () => {
      release({ count: 1, skipped: 0, listName: 'L', places: [] });
      await first;
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);
  });

  it('FE-PLANNER-LISTIMP-013: works without a pushUndo', async () => {
    vi.spyOn(placesApi, 'importGoogleList').mockResolvedValue({
      count: 1,
      skipped: 0,
      listName: 'L',
      places: [{ id: 1 }],
    });
    const { result, toast } = setup({ pushUndo: undefined });
    await importUrl(result, 'https://maps.app.goo.gl/abc');
    expect(toast.success).toHaveBeenCalledWith('places.googleListImported:1,L');
    expect(result.current.open).toBe(false);
  });

  it('FE-PLANNER-LISTIMP-014: the desktop dialog leaves the in-flight guard to its button', async () => {
    const releases: ((value: unknown) => void)[] = [];
    const google = vi.spyOn(placesApi, 'importGoogleList').mockImplementation(
      () =>
        new Promise((resolve) => {
          releases.push(resolve);
        })
    );
    const { result } = setup();
    act(() => result.current.setUrl('https://maps.app.goo.gl/abc'));

    let first!: Promise<void>;
    act(() => {
      first = result.current.handleImport();
    });
    expect(result.current.loading).toBe(true);
    let second!: Promise<void>;
    act(() => {
      second = result.current.handleImport();
    });
    // The preview answers first, then each call imports directly.
    await act(async () => {});
    expect(google).toHaveBeenCalledTimes(2);

    await act(async () => {
      releases.forEach((release) => release({ count: 1, skipped: 0, listName: 'L', places: [] }));
      await Promise.all([first, second]);
    });
    expect(result.current.loading).toBe(false);
  });

  describe('Google list preview', () => {
    const listPreview = {
      kind: 'list' as const,
      listName: 'Weekend',
      places: [
        {
          key: '0',
          name: 'Cafe',
          lat: 1,
          lng: 2,
          notes: null,
          googleFtid: 'f0',
          country: 'NL',
          bucket: 'new' as const,
          match: null,
          hint: null,
        },
      ],
    };
    const request = { listName: 'Weekend', places: [], link: [], movePin: [] };

    it('FE-PLANNER-LISTIMP-015: a list answer holds the preview and imports nothing yet', async () => {
      vi.mocked(placeListImportApi.previewGoogleList).mockResolvedValue(listPreview);
      const google = vi.spyOn(placesApi, 'importGoogleList');
      const { result, loadTrip } = setup();
      await importUrl(result, ' https://maps.app.goo.gl/abc ');
      expect(placeListImportApi.previewGoogleList).toHaveBeenCalledWith(1, 'https://maps.app.goo.gl/abc');
      expect(result.current.previewData).toEqual(listPreview);
      expect(google).not.toHaveBeenCalled();
      expect(loadTrip).not.toHaveBeenCalled();
      expect(result.current.loading).toBe(false);
    });

    it('FE-PLANNER-LISTIMP-024: close drops the preview with the link and shuts the dialog, so a reopen starts clean', async () => {
      vi.mocked(placeListImportApi.previewGoogleList).mockResolvedValue(listPreview);
      const { result } = setup();
      act(() => result.current.setOpen(true));
      await importUrl(result, 'https://maps.app.goo.gl/abc');
      expect(result.current.previewData).toEqual(listPreview);
      act(() => result.current.close());
      expect(result.current.open).toBe(false);
      expect(result.current.url).toBe('');
      expect(result.current.previewData).toBeNull();
    });

    it('FE-PLANNER-LISTIMP-016: a directions answer runs the direct import with its usual toast', async () => {
      const google = vi
        .spyOn(placesApi, 'importGoogleList')
        .mockResolvedValue({ count: 1, skipped: 0, listName: 'Tokyo', places: [{ id: 5 }] });
      const { result, toast, pushUndo } = setup();
      await importUrl(result, 'https://maps.app.goo.gl/abc');
      expect(google).toHaveBeenCalledWith(1, 'https://maps.app.goo.gl/abc', false);
      expect(result.current.previewData).toBeNull();
      expect(toast.success).toHaveBeenCalledWith('places.googleListImported:1,Tokyo');
      expect(pushUndo).toHaveBeenCalledWith('undo.importGoogleList', expect.any(Function));
    });

    it('FE-PLANNER-LISTIMP-017: a failed preview shows the server message and holds nothing', async () => {
      vi.mocked(placeListImportApi.previewGoogleList).mockRejectedValue({
        response: { data: { error: 'List is private' } },
      });
      const { result, toast } = setup();
      await importUrl(result, 'https://maps.app.goo.gl/abc');
      expect(toast.error).toHaveBeenCalledWith('List is private');
      expect(result.current.previewData).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('FE-PLANNER-LISTIMP-018: committing reloads, toasts, closes and registers one undo that deletes only the created places', async () => {
      vi.mocked(placeListImportApi.previewGoogleList).mockResolvedValue(listPreview);
      const commit = vi.spyOn(placeListImportApi, 'commitGoogleList').mockResolvedValue({
        places: [{ id: 31 }, { id: 32 }] as never,
        count: 2,
        listName: 'Weekend',
        linked: 1,
        moved: 1,
        stale: 0,
      });
      const bulkDelete = vi.spyOn(placesApi, 'bulkDelete').mockResolvedValue({ deleted: 2 });
      const { result, toast, loadTrip, pushUndo } = setup();
      act(() => result.current.setOpen(true));
      await importUrl(result, 'https://maps.app.goo.gl/abc');

      await act(async () => {
        await result.current.handleCommit(request);
      });
      expect(commit).toHaveBeenCalledWith(1, { ...request, enrich: false });
      expect(loadTrip).toHaveBeenCalledWith(1);
      expect(toast.success).toHaveBeenCalledWith(
        'places.googleListImported:2,Weekend · places.listPreview.toastLinked:1 · places.listPreview.toastMoved:1'
      );
      expect(result.current.open).toBe(false);
      expect(result.current.previewData).toBeNull();
      expect(pushUndo).toHaveBeenCalledTimes(1);
      expect(pushUndo).toHaveBeenCalledWith('undo.importGoogleList', expect.any(Function));
      await (pushUndo.mock.calls[0][1] as () => Promise<void>)();
      expect(bulkDelete).toHaveBeenCalledWith(1, [31, 32]);
    });

    it('FE-PLANNER-LISTIMP-019: a commit that changes nothing warns and registers no undo', async () => {
      vi.spyOn(placeListImportApi, 'commitGoogleList').mockResolvedValue({
        places: [],
        count: 0,
        listName: 'Weekend',
        linked: 0,
        moved: 0,
        stale: 0,
      });
      const { result, toast, pushUndo } = setup();
      await act(async () => {
        await result.current.handleCommit(request);
      });
      expect(toast.warning).toHaveBeenCalledWith('places.importAllSkipped');
      expect(pushUndo).not.toHaveBeenCalled();
    });

    it('FE-PLANNER-LISTIMP-020: a commit of only links and moves toasts what it linked and moved, not 0 places', async () => {
      const commit = vi.spyOn(placeListImportApi, 'commitGoogleList').mockResolvedValue({
        places: [],
        count: 0,
        listName: 'Weekend',
        linked: 2,
        moved: 0,
        stale: 0,
      });
      const { result, toast } = setup();
      await act(async () => {
        await result.current.handleCommit(request);
      });
      expect(toast.success).toHaveBeenLastCalledWith('places.listPreview.toastLinked:2');
      commit.mockResolvedValue({ places: [], count: 0, listName: 'Weekend', linked: 1, moved: 3, stale: 0 });
      await act(async () => {
        await result.current.handleCommit(request);
      });
      expect(toast.success).toHaveBeenLastCalledWith(
        'places.listPreview.toastLinked:1 · places.listPreview.toastMoved:3'
      );
    });

    it('FE-PLANNER-LISTIMP-021: enrichment goes with the commit only with a maps key; a failed commit keeps the preview', async () => {
      seedStore(useAuthStore, { hasMapsKey: true });
      vi.mocked(placeListImportApi.previewGoogleList).mockResolvedValue(listPreview);
      const commit = vi.spyOn(placeListImportApi, 'commitGoogleList').mockRejectedValue(new Error('network'));
      const { result, toast, loadTrip } = setup();
      await importUrl(result, 'https://maps.app.goo.gl/abc');
      await act(async () => {
        await result.current.handleCommit({ ...request, enrich: true });
      });
      expect(commit).toHaveBeenCalledWith(1, { ...request, enrich: true });
      expect(toast.error).toHaveBeenCalledWith('places.googleListError');
      expect(loadTrip).not.toHaveBeenCalled();
      expect(result.current.previewData).toEqual(listPreview);
      expect(result.current.loading).toBe(false);
    });

    it('FE-PLANNER-LISTIMP-025: a failed reload after a landed commit still closes the preview and registers the undo', async () => {
      vi.mocked(placeListImportApi.previewGoogleList).mockResolvedValue(listPreview);
      const commit = vi.spyOn(placeListImportApi, 'commitGoogleList').mockResolvedValue({
        places: [{ id: 31 }] as never,
        count: 1,
        listName: 'Weekend',
        linked: 0,
        moved: 0,
        stale: 0,
      });
      const { result, toast, loadTrip, pushUndo } = setup();
      act(() => result.current.setOpen(true));
      await importUrl(result, 'https://maps.app.goo.gl/abc');
      loadTrip.mockRejectedValueOnce(new Error('offline'));

      await act(async () => {
        await result.current.handleCommit(request);
      });
      expect(commit).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalledWith('places.googleListImported:1,Weekend');
      expect(toast.error).not.toHaveBeenCalled();
      expect(pushUndo).toHaveBeenCalledTimes(1);
      // The dialog offers a commit only while it holds a preview.
      expect(result.current.previewData).toBeNull();
      expect(result.current.open).toBe(false);
      expect(result.current.loading).toBe(false);
    });

    it('FE-PLANNER-LISTIMP-026: a second commit while one is in flight is refused', async () => {
      let land: (value: Awaited<ReturnType<typeof placeListImportApi.commitGoogleList>>) => void = () => {};
      const commit = vi.spyOn(placeListImportApi, 'commitGoogleList').mockImplementation(
        () =>
          new Promise((resolve) => {
            land = resolve;
          })
      );
      const { result } = setup();
      let first: Promise<void> = Promise.resolve();
      act(() => {
        first = result.current.handleCommit(request);
        void result.current.handleCommit(request);
      });
      expect(commit).toHaveBeenCalledTimes(1);
      await act(async () => {
        land({ places: [], count: 0, listName: 'Weekend', linked: 1, moved: 0, stale: 0 });
        await first;
      });
      let again: Promise<void> = Promise.resolve();
      act(() => {
        again = result.current.handleCommit(request);
      });
      expect(commit).toHaveBeenCalledTimes(2);
      await act(async () => {
        land({ places: [], count: 0, listName: 'Weekend', linked: 1, moved: 0, stale: 0 });
        await again;
      });
    });

    it('FE-PLANNER-LISTIMP-022: backToLink drops the preview and keeps the link', async () => {
      vi.mocked(placeListImportApi.previewGoogleList).mockResolvedValue(listPreview);
      const { result } = setup();
      await importUrl(result, 'https://maps.app.goo.gl/abc');
      act(() => result.current.backToLink());
      expect(result.current.previewData).toBeNull();
      expect(result.current.url).toBe('https://maps.app.goo.gl/abc');
    });

    it('FE-PLANNER-LISTIMP-023: Naver never asks for a preview', async () => {
      vi.spyOn(placesApi, 'importNaverList').mockResolvedValue({ count: 1, skipped: 0, listName: 'S', places: [] });
      const { result } = setup();
      act(() => result.current.setProvider('naver'));
      await importUrl(result, 'https://naver.me/xyz');
      expect(placeListImportApi.previewGoogleList).not.toHaveBeenCalled();
    });
  });
});
