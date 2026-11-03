import type {
  PlaceListCommitRequest,
  PlaceListCommitResponse,
  PlaceListPreviewRequest,
  PlaceListPreviewResponse,
} from '@trek/shared';
import apiClient from './client';

/** Previewing and committing a shared Google Maps list (the preview comes first, nothing is created by it). */
export const placeListImportApi = {
  previewGoogleList: (tripId: number | string, url: string): Promise<PlaceListPreviewResponse> =>
    apiClient
      .post(`/trips/${tripId}/places/import/google-list/preview`, { url } satisfies PlaceListPreviewRequest, {
        timeout: 60000,
      })
      .then((r) => r.data),
  commitGoogleList: (tripId: number | string, body: PlaceListCommitRequest): Promise<PlaceListCommitResponse> =>
    apiClient.post(`/trips/${tripId}/places/import/google-list/commit`, body, { timeout: 60000 }).then((r) => r.data),
};
