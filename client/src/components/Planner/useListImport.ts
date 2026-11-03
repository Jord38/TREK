import { useRef, useState } from 'react';

import type { PlaceListCommitRequest, PlaceListCommitResponse } from '@trek/shared';
import { placesApi } from '../../api/client';
import { placeListImportApi } from '../../api/placeListImport';
import type { useTranslation } from '../../i18n';
import { useAuthStore } from '../../store/authStore';
import { offlineOr } from '../../utils/needsConnection';
import type { useToast } from '../shared/Toast';
import type { ListPreviewData } from './useListImportPreview';

export type ListImportProvider = 'google' | 'naver';

export interface ListImportOptions {
  tripId: number;
  t: ReturnType<typeof useTranslation>['t'];
  toast: ReturnType<typeof useToast>;
  loadTrip: (tripId: number) => Promise<unknown>;
  pushUndo?: (label: string, undoFn: () => Promise<void> | void) => void;
  /**
   * Where a successful import hands over, after its undo step is registered: the phone's
   * import sheet closes here. Without it the import runs as the desktop dialog, which
   * closes itself and clears the link before the undo step goes in.
   */
  onDone?: () => void;
}

interface ImportMessage {
  warning: boolean;
  text: string;
}

function serverErrorOr(t: ListImportOptions['t'], err: unknown, fallback: string) {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error || offlineOr(t, fallback);
}

/**
 * Toast, leave the dialog, register an undo step that deletes the created places, then reload.
 * The import has landed by now, so a failed reload must not keep the dialog open for a second,
 * duplicate import.
 */
async function finish(
  { tripId, toast, loadTrip, pushUndo, onDone, leave }: Omit<ListImportOptions, 't'> & { leave: () => void },
  message: ImportMessage,
  undoLabel: string,
  created: { id: number }[]
) {
  if (message.warning) toast.warning(message.text);
  else toast.success(message.text);
  leave();
  if (created.length > 0) {
    const createdIds = created.map((p) => p.id);
    pushUndo?.(undoLabel, async () => {
      try {
        await placesApi.bulkDelete(tripId, createdIds);
      } catch {
        // best effort: the trip reload below reflects whatever happened
      }
      await loadTrip(tripId);
    });
  }
  onDone?.();
  try {
    await loadTrip(tripId);
  } catch {
    // best effort: the websocket and the next load bring the trip up to date
  }
}

/** What a preview commit changed: created places, then linked ids and moved pins when there are any. */
function commitMessage(t: ListImportOptions['t'], result: PlaceListCommitResponse): ImportMessage {
  const parts = [
    result.count > 0 ? t('places.googleListImported', { count: result.count, list: result.listName }) : null,
    result.linked > 0 ? t('places.listPreview.toastLinked', { count: result.linked }) : null,
    result.moved > 0 ? t('places.listPreview.toastMoved', { count: result.moved }) : null,
  ].filter((part): part is string => part !== null);
  if (parts.length === 0) return { warning: true, text: t('places.importAllSkipped') };
  return { warning: false, text: parts.join(' · ') };
}

/**
 * Importing a shared Google Maps or Naver list into the trip's places: the one logic
 * path behind the desktop dialog and the phone's import step, which render their own
 * markup over it. Same endpoints, the same optional Google enrichment, a toast for what
 * came in (or a warning when every entry was already there), and an undo step that
 * deletes the imported places again.
 */
export function useListImport({ tripId, t, toast, loadTrip, pushUndo, onDone }: ListImportOptions) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<ListImportProvider>('google');
  const [enrich, setEnrich] = useState(false);
  const [previewData, setPreviewData] = useState<ListPreviewData | null>(null);
  // State lags a render behind: two clicks in one frame would both see loading === false.
  const committing = useRef(false);
  // Places-API enrichment (#886) needs a Google Maps key. Not the places
  // *provider* choice: enrichment's photos and summary come from Google (and,
  // keyless, from Wikimedia), which is independent of which provider answers
  // search: an Amap install with a Google key still enriches through Google.
  const canEnrich = useAuthStore((s) => s.hasMapsKey);

  /** The desktop dialog's way out: closed, and the link it held gone with it. */
  const close = () => {
    setOpen(false);
    setUrl('');
    setPreviewData(null);
  };

  const leave = () => (onDone ? setPreviewData(null) : close());
  const finishImport = (message: ImportMessage, undoLabel: string, created: { id: number }[]) =>
    finish({ tripId, toast, loadTrip, pushUndo, onDone, leave }, message, undoLabel, created);

  const handleImport = async () => {
    const trimmed = url.trim();
    // Only the phone step refuses a second import itself; the desktop dialog gates its
    // button and Enter key on the loading flag instead.
    if (!trimmed || (onDone && loading)) return;
    if (provider === 'google') {
      await handlePreview(trimmed);
      return;
    }
    await runDirectImport(trimmed);
  };

  /** A Google list opens a preview; a directions link has no list, so it imports as before. */
  const handlePreview = async (trimmed: string) => {
    setLoading(true);
    let answer;
    try {
      answer = await placeListImportApi.previewGoogleList(tripId, trimmed);
    } catch (err: unknown) {
      toast.error(serverErrorOr(t, err, t('places.googleListError')));
      return;
    } finally {
      setLoading(false);
    }
    if (answer.kind === 'list') setPreviewData(answer);
    else await runDirectImport(trimmed);
  };

  const backToLink = () => setPreviewData(null);

  /** Imports what the preview's ticks chose; the undo step deletes the created places only. */
  const handleCommit = async (request: PlaceListCommitRequest) => {
    if (committing.current) return;
    committing.current = true;
    setLoading(true);
    try {
      const result = await placeListImportApi.commitGoogleList(tripId, {
        ...request,
        enrich: !!request.enrich && canEnrich,
      });
      await finishImport(commitMessage(t, result), t('undo.importGoogleList'), result.places);
    } catch (err: unknown) {
      toast.error(serverErrorOr(t, err, t('places.googleListError')));
    } finally {
      committing.current = false;
      setLoading(false);
    }
  };

  const runDirectImport = async (trimmed: string) => {
    setLoading(true);
    try {
      const withEnrich = enrich && canEnrich;
      const result =
        provider === 'google'
          ? await placesApi.importGoogleList(tripId, trimmed, withEnrich)
          : await placesApi.importNaverList(tripId, trimmed, withEnrich);
      const allSkipped = result.count === 0 && result.skipped > 0;
      await finishImport(
        {
          warning: allSkipped,
          text: allSkipped
            ? t('places.importAllSkipped')
            : t(provider === 'google' ? 'places.googleListImported' : 'places.naverListImported', {
                count: result.count,
                list: result.listName,
              }),
        },
        t(provider === 'google' ? 'undo.importGoogleList' : 'undo.importNaverList'),
        result.places ?? []
      );
    } catch (err: unknown) {
      toast.error(
        serverErrorOr(t, err, provider === 'google' ? t('places.googleListError') : t('places.naverListError'))
      );
    } finally {
      setLoading(false);
    }
  };

  return {
    open,
    setOpen,
    url,
    setUrl,
    loading,
    provider,
    setProvider,
    enrich,
    setEnrich,
    canEnrich,
    handleImport,
    previewData,
    handleCommit,
    backToLink,
    close,
  };
}
