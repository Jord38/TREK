import { Places } from '../../../src/db/entities/Places.entity';
import { PlacesListImportService } from '../../../src/nest/places/places-list-import.service';
import { PlacesService } from '../../../src/nest/places/places.service';
import { createSnapshotTestDb } from '../../helpers/db-mock';
import { createPlace, createTrip, createUser } from '../../helpers/factories';
import { countRows, findRow, findRows, updateRows } from '../../helpers/factories/rows';
import { resetTestDb } from '../../helpers/test-db';
import { createTestModule, type TestModule } from '../../helpers/test-module';
import { sharedTestOrm } from '../../helpers/test-uow';
import { getRepositoryToken } from '@mikro-orm/nestjs';
import type { PlaceListCommitRequest } from '@trek/shared';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const testDb = createSnapshotTestDb();
const broadcast = vi.fn();
const onUpdated = vi.fn().mockResolvedValue(undefined);
const enrichImportedList = vi.fn().mockResolvedValue(undefined);
const orm = () => sharedTestOrm(testDb);

async function readPlace(id: number) {
  const row = await findRow(await orm(), Places, { id });
  if (!row) throw new Error(`place ${id} missing`);
  return row;
}

let t: TestModule;
let service: PlacesListImportService;
let tripId: number;

function request(over: Partial<PlaceListCommitRequest> = {}): PlaceListCommitRequest {
  return { listName: 'Eats', places: [], link: [], movePin: [], ...over };
}

const ramen = { name: 'Ramen House', lat: 35.66, lng: 139.7, notes: 'good', googleFtid: '0x1:0x2' };

beforeAll(async () => {
  const repo = (await orm()).repo(Places);
  t = await createTestModule({
    db: testDb,
    imports: [],
    providers: [
      PlacesListImportService,
      { provide: PlacesService, useValue: { broadcast, enrichImportedList, onUpdated } },
      { provide: getRepositoryToken(Places), useValue: repo },
    ],
  });
  service = t.get(PlacesListImportService);
});

afterAll(async () => {
  await t.close();
  testDb.close();
});

beforeEach(() => {
  resetTestDb(testDb);
  broadcast.mockClear();
  onUpdated.mockClear();
  enrichImportedList.mockClear();
  const { user } = createUser(testDb);
  tripId = createTrip(testDb, user.id).id;
});

describe('PlacesListImportService', () => {
  it('test01_inserts_every_sent_place_even_when_the_name_already_exists_in_the_trip', async () => {
    createPlace(testDb, tripId, { name: 'Ramen House', lat: 35.66, lng: 139.7 });
    const res = await service.commitGoogleList(tripId, request({ places: [ramen] }), { userId: 1 });
    expect(res).toMatchObject({ count: 1, listName: 'Eats', linked: 0, moved: 0, stale: 0 });
    expect(await countRows(await orm(), Places, { trip: tripId })).toBe(2);
    const created = await findRow(await orm(), Places, { id: res.places[0].id });
    expect(created).toMatchObject({ name: 'Ramen House', notes: 'good', google_ftid: '0x1:0x2' });
  });

  it('test02_broadcasts_place_created_per_new_place_with_the_socket_id', async () => {
    const res = await service.commitGoogleList(tripId, request({ places: [ramen, { ...ramen, name: 'B' }] }), {
      socketId: 'sock-1',
    });
    expect(broadcast).toHaveBeenCalledTimes(2);
    expect(broadcast).toHaveBeenCalledWith(String(tripId), 'place:created', { place: res.places[0] }, 'sock-1');
  });

  it('test03_backfills_addresses_of_created_places_always_and_enriches_only_when_asked', async () => {
    await service.commitGoogleList(tripId, request({ places: [ramen] }), { userId: 5 });
    expect(enrichImportedList).toHaveBeenCalledTimes(1);
    expect(enrichImportedList.mock.calls[0][2]).toMatchObject({ enrich: false, userId: 5 });
    await service.commitGoogleList(tripId, request({ places: [ramen], enrich: true }), { userId: 5 });
    expect(enrichImportedList).toHaveBeenCalledTimes(2);
    expect(enrichImportedList.mock.calls[1][2]).toMatchObject({ enrich: true, userId: 5 });
    await service.commitGoogleList(tripId, request({ places: [] }), { userId: 5 });
    expect(enrichImportedList).toHaveBeenCalledTimes(2);
  });

  it('test04_link_attaches_the_id_only_to_a_place_that_has_none', async () => {
    const bare = createPlace(testDb, tripId, { name: 'Bare' });
    const known = createPlace(testDb, tripId, { name: 'Known' });
    await updateRows(await orm(), Places, { id: known.id }, { google_ftid: '0xold' });
    const res = await service.commitGoogleList(
      tripId,
      request({
        link: [
          { placeId: bare.id, googleFtid: '0xnew' },
          { placeId: known.id, googleFtid: '0xnew' },
        ],
      }),
      {},
    );
    expect(res).toMatchObject({ count: 0, linked: 1, stale: 0 });
    expect((await findRow(await orm(), Places, { id: bare.id }))?.google_ftid).toBe('0xnew');
    expect((await findRow(await orm(), Places, { id: known.id }))?.google_ftid).toBe('0xold');
  });

  it('test05_two_links_to_the_same_place_attach_once_and_count_once', async () => {
    const bare = createPlace(testDb, tripId, { name: 'Bare' });
    const res = await service.commitGoogleList(
      tripId,
      request({
        link: [
          { placeId: bare.id, googleFtid: '0xfirst' },
          { placeId: bare.id, googleFtid: '0xsecond' },
        ],
      }),
      {},
    );
    expect(res.linked).toBe(1);
    expect((await findRow(await orm(), Places, { id: bare.id }))?.google_ftid).toBe('0xfirst');
  });

  it('test06_move_pin_sets_coordinates_and_ftid_and_keeps_every_other_column', async () => {
    const place = createPlace(testDb, tripId, { name: 'Pin', lat: 1, lng: 2, description: 'keep me' });
    await updateRows(await orm(), Places, { id: place.id }, { notes: 'n', website: 'https://x.test', price: 9 });
    const before = await readPlace(place.id);
    const res = await service.commitGoogleList(
      tripId,
      request({ movePin: [{ placeId: place.id, lat: 35.1, lng: 139.2, googleFtid: '0xg' }] }),
      { socketId: 's' },
    );
    expect(res).toMatchObject({ moved: 1, stale: 0 });
    const after = await readPlace(place.id);
    const { lat, lng, google_ftid, updated_at: _after, ...rest } = after;
    const { lat: _l, lng: _g, google_ftid: _f, updated_at: _before, ...restBefore } = before;
    expect({ lat, lng, google_ftid }).toEqual({ lat: 35.1, lng: 139.2, google_ftid: '0xg' });
    expect(rest).toEqual(restBefore);
    expect(broadcast).toHaveBeenCalledWith(
      String(tripId),
      'place:updated',
      { place: expect.objectContaining({ id: place.id, lat: 35.1 }) },
      's',
    );
  });

  it('test07_move_pin_without_an_ftid_leaves_the_existing_one', async () => {
    const place = createPlace(testDb, tripId, { name: 'Pin' });
    await updateRows(await orm(), Places, { id: place.id }, { google_ftid: '0xkeep' });
    await service.commitGoogleList(
      tripId,
      request({ movePin: [{ placeId: place.id, lat: 3, lng: 4, googleFtid: null }] }),
      {},
    );
    expect((await findRow(await orm(), Places, { id: place.id }))?.google_ftid).toBe('0xkeep');
  });

  it('test08_a_place_of_another_trip_or_a_missing_one_counts_as_stale_and_the_places_still_insert', async () => {
    const { user } = createUser(testDb);
    const other = createTrip(testDb, user.id);
    const foreign = createPlace(testDb, other.id, { name: 'Foreign', lat: 7, lng: 8 });
    const res = await service.commitGoogleList(
      tripId,
      request({
        places: [ramen],
        link: [{ placeId: foreign.id, googleFtid: '0xx' }],
        movePin: [
          { placeId: foreign.id, lat: 1, lng: 1, googleFtid: '0xy' },
          { placeId: 99999, lat: 1, lng: 1, googleFtid: null },
        ],
      }),
      {},
    );
    expect(res).toMatchObject({ count: 1, linked: 0, moved: 0, stale: 3 });
    expect(await findRow(await orm(), Places, { id: foreign.id })).toMatchObject({ lat: 7, lng: 8, google_ftid: null });
    expect(broadcast).toHaveBeenCalledTimes(1);
  });

  it('test09_a_failing_later_write_rolls_back_the_inserts_and_the_link', async () => {
    const bare = createPlace(testDb, tripId, { name: 'Bare', lat: 1, lng: 2 });
    const spy = vi.spyOn((await orm()).repo(Places), 'updatePlace').mockRejectedValueOnce(new Error('disk full'));
    await expect(
      service.commitGoogleList(
        tripId,
        request({
          places: [ramen, { ...ramen, name: 'Second' }],
          link: [{ placeId: bare.id, googleFtid: '0xnew' }],
          movePin: [{ placeId: bare.id, lat: 9, lng: 9, googleFtid: null }],
        }),
        {},
      ),
    ).rejects.toThrow('disk full');
    spy.mockRestore();
    expect(await findRow(await orm(), Places, { id: bare.id })).toMatchObject({ lat: 1, lng: 2, google_ftid: null });
    expect(await findRows(await orm(), Places, { trip: tripId })).toHaveLength(1);
    expect(broadcast).not.toHaveBeenCalled();
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('test10_runs_the_journey_sync_for_moved_pins_only', async () => {
    const bare = createPlace(testDb, tripId, { name: 'Bare' });
    const pin = createPlace(testDb, tripId, { name: 'Pin' });
    await service.commitGoogleList(
      tripId,
      request({
        places: [ramen],
        link: [{ placeId: bare.id, googleFtid: '0xnew' }],
        movePin: [{ placeId: pin.id, lat: 3, lng: 4, googleFtid: null }],
      }),
      {},
    );
    expect(onUpdated.mock.calls).toEqual([[pin.id]]);
  });
});
