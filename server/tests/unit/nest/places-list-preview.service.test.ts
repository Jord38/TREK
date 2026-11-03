import { Places } from '../../../src/db/entities/Places.entity';
import { matchListPlace } from '../../../src/nest/place-import/list-match';
import { PlaceImportService } from '../../../src/nest/place-import/place-import.service';
import { PlacesListPreviewService } from '../../../src/nest/places/places-list-preview.service';
import { createSnapshotTestDb } from '../../helpers/db-mock';
import { createTestModule, type TestModule } from '../../helpers/test-module';
import { getRepositoryToken } from '@mikro-orm/nestjs';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const TOKYO = { lat: 35.6595, lng: 139.7005 };
const SEOUL = { lat: 37.5665, lng: 126.978 };
const PACIFIC = { lat: 0, lng: -140 };

function row(over: Record<string, unknown>) {
  return {
    id: 1,
    name: 'Row',
    lat: null,
    lng: null,
    google_place_id: null,
    google_ftid: null,
    route_geometry: null,
    ...over,
  };
}

const repo = { listAllForTrip: vi.fn(), insertPlace: vi.fn(), update: vi.fn(), delete: vi.fn() };
const readGoogleList = vi.fn();

const db = createSnapshotTestDb();
let t: TestModule;
let service: PlacesListPreviewService;

beforeAll(async () => {
  t = await createTestModule({
    db,
    imports: [],
    providers: [
      PlacesListPreviewService,
      // Real matching rule, faked list read.
      { provide: PlaceImportService, useValue: { readGoogleList, classifyListPlace: matchListPlace } },
      { provide: getRepositoryToken(Places), useValue: repo },
    ],
  });
  service = t.get(PlacesListPreviewService);
});

afterAll(async () => {
  await t.close();
  db.close();
});

beforeEach(() => {
  for (const fn of [...Object.values(repo), readGoogleList]) fn.mockReset();
  repo.listAllForTrip.mockResolvedValue([]);
});

describe('PlacesListPreviewService', () => {
  it('test01_classifies_each_place_and_sets_country_from_coordinates', async () => {
    readGoogleList.mockResolvedValue({
      listName: 'Eats',
      places: [
        { name: 'Ramen House', ...TOKYO, notes: 'good', googleFtid: '0x1:0x2' },
        { name: 'Ramen House', lat: TOKYO.lat + 0.025, lng: TOKYO.lng, notes: null, googleFtid: null },
        { name: 'Totally Other', ...SEOUL, notes: null, googleFtid: null },
        { name: 'Buoy', ...PACIFIC, notes: null, googleFtid: null },
      ],
    });
    repo.listAllForTrip.mockResolvedValue([row({ id: 7, name: 'Ramen House', ...TOKYO })]);
    const res = await service.previewGoogleList(5, 'https://maps.app.goo.gl/x');
    expect(res.kind).toBe('list');
    if (res.kind !== 'list') return;
    expect(res.listName).toBe('Eats');
    expect(res.places.map((p) => p.key)).toEqual(['0', '1', '2', '3']);
    expect(res.places.map((p) => p.bucket)).toEqual(['existing', 'check', 'new', 'new']);
    expect(res.places.map((p) => p.country)).toEqual(['JP', 'JP', 'KR', null]);
    expect(res.places[0].notes).toBe('good');
    expect(res.places[0].match?.placeId).toBe(7);
  });

  it('test02_writes_nothing', async () => {
    readGoogleList.mockResolvedValue({
      listName: 'L',
      places: [{ name: 'A', ...TOKYO, notes: null, googleFtid: null }],
    });
    await service.previewGoogleList(5, 'u');
    expect(repo.insertPlace).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('test03_answers_directions_when_the_link_resolves_to_a_route', async () => {
    readGoogleList.mockResolvedValue({ directions: 'https://www.google.com/maps/dir/a/b' });
    expect(await service.previewGoogleList(5, 'u')).toEqual({ kind: 'directions' });
    expect(repo.listAllForTrip).not.toHaveBeenCalled();
  });

  it('test04_throws_the_providers_status_on_a_read_error', async () => {
    readGoogleList.mockResolvedValue({ error: 'List is private', status: 403 });
    await expect(service.previewGoogleList(5, 'u')).rejects.toMatchObject({ status: 403 });
  });

  it('test05_turns_a_failed_read_into_a_400_like_the_direct_import', async () => {
    readGoogleList.mockRejectedValue(new Error('socket hang up'));
    await expect(service.previewGoogleList(5, 'u')).rejects.toMatchObject({
      status: 400,
      message: 'Failed to import Google Maps list. Make sure the list is shared publicly.',
    });
  });

  it('test06_reads_the_trip_places_by_the_numeric_trip_id', async () => {
    readGoogleList.mockResolvedValue({ listName: 'L', places: [] });
    await service.previewGoogleList(5, 'u');
    expect(repo.listAllForTrip).toHaveBeenCalledWith(5);
  });
});
