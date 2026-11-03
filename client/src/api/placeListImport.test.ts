// FE-PLACELISTAPI-001 to FE-PLACELISTAPI-002: the Google list preview and commit endpoints.
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../tests/helpers/msw/server';
import { placeListImportApi } from './placeListImport';

describe('placeListImportApi', () => {
  it('FE-PLACELISTAPI-001: the preview posts the link and returns the answer', async () => {
    let received: unknown;
    server.use(
      http.post('/api/trips/1/places/import/google-list/preview', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ kind: 'directions' });
      })
    );
    await expect(placeListImportApi.previewGoogleList(1, 'https://maps.app.goo.gl/x')).resolves.toEqual({
      kind: 'directions',
    });
    expect(received).toEqual({ url: 'https://maps.app.goo.gl/x' });
  });

  it('FE-PLACELISTAPI-002: the commit posts the chosen places, links and pin moves', async () => {
    let received: unknown;
    server.use(
      http.post('/api/trips/1/places/import/google-list/commit', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(
          { places: [], count: 0, listName: 'L', linked: 0, moved: 0, stale: 0 },
          { status: 201 }
        );
      })
    );
    const body = { listName: 'L', places: [], link: [{ placeId: 3, googleFtid: 'f' }], movePin: [] };
    await placeListImportApi.commitGoogleList(1, body);
    expect(received).toEqual(body);
  });
});
