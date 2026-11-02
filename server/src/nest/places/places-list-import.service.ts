import { Places } from '../../db/entities/Places.entity';
import type { PlaceRow, PlaceWithTagsRow, PlacesRepository } from '../../db/repositories/Places.repository';
import { UnitOfWork } from '../database/unit-of-work';
import { googleListInsertRow } from './google-list-insert-row';
import type { EnrichablePlace, ListImportOptions } from './places.helpers';
import { PlacesService } from './places.service';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';
import type { PlaceListCommitRequest } from '@trek/shared';

export interface ListCommitOptions extends ListImportOptions {
  socketId?: string;
}

export interface ListCommitResult {
  places: PlaceWithTagsRow[];
  count: number;
  listName: string;
  linked: number;
  moved: number;
  stale: number;
}

/** Writes what the list preview's Import sends back: new places, attached ids and moved pins, in one transaction. */
@Injectable()
export class PlacesListImportService {
  constructor(
    private readonly places: PlacesService,
    private readonly uow: UnitOfWork,
    @InjectRepository(Places) private readonly placesRepo: PlacesRepository,
  ) {}

  /**
   * @txIndependent the background enrichment runs after the transaction, as in importGoogleList.
   */
  async commitGoogleList(
    tripId: number,
    body: PlaceListCommitRequest,
    opts: ListCommitOptions,
  ): Promise<ListCommitResult> {
    const created: PlaceWithTagsRow[] = [];
    const moved: PlaceWithTagsRow[] = [];
    const linked = new Set<number>();
    const movedIds = new Set<number>();
    let stale = 0;

    await this.uow.transactional(async () => {
      for await (const p of body.places) {
        const id = await this.placesRepo.insertPlace(
          googleListInsertRow(tripId, { ...p, notes: p.notes ?? null, googleFtid: p.googleFtid ?? null }),
        );
        created.push(await this.load(id));
      }

      for await (const { placeId, googleFtid } of body.link) {
        if (linked.has(placeId)) continue;
        const row = await this.placesRepo.findInTrip(placeId, tripId);
        if (!row) stale++;
        else if (!row.google_ftid) {
          await this.placesRepo.backfillFtid(placeId, googleFtid);
          linked.add(placeId);
        }
      }

      for await (const pin of body.movePin) {
        if (movedIds.has(pin.placeId)) continue;
        const row = await this.placesRepo.findInTrip(pin.placeId, tripId);
        if (!row) {
          stale++;
          continue;
        }
        await this.placesRepo.updatePlace(pin.placeId, {
          ...pickUpdatable(row),
          lat: pin.lat,
          lng: pin.lng,
          google_ftid: pin.googleFtid ?? row.google_ftid,
        });
        movedIds.add(pin.placeId);
        moved.push(await this.load(pin.placeId));
      }
    });

    const trip = String(tripId);
    for (const place of created) this.places.broadcast(trip, 'place:created', { place }, opts.socketId);
    for await (const place of moved) {
      this.places.broadcast(trip, 'place:updated', { place }, opts.socketId);
      await this.places.onUpdated(place.id);
    }
    if (created.length) {
      void this.places.enrichImportedList(trip, created as EnrichablePlace[], { ...opts, enrich: !!body.enrich });
    }

    return {
      places: created,
      count: created.length,
      listName: body.listName,
      linked: linked.size,
      moved: movedIds.size,
      stale,
    };
  }

  private async load(id: number): Promise<PlaceWithTagsRow> {
    const place = await this.placesRepo.findWithTagsAndRatings(id);
    if (!place) throw new Error(`Place ${id} vanished inside its own transaction`);
    return place;
  }
}

/** The columns `updatePlace` writes, as they are now: a pin move changes nothing else. */
function pickUpdatable(row: PlaceRow): Parameters<PlacesRepository['updatePlace']>[1] {
  return {
    name: row.name,
    description: row.description,
    lat: row.lat,
    lng: row.lng,
    address: row.address,
    category_id: row.category_id,
    price: row.price,
    currency: row.currency,
    place_time: row.place_time,
    end_time: row.end_time,
    duration_minutes: row.duration_minutes,
    notes: row.notes,
    image_url: row.image_url,
    google_place_id: row.google_place_id,
    google_ftid: row.google_ftid,
    osm_id: row.osm_id,
    amap_poi_id: row.amap_poi_id,
    website: row.website,
    phone: row.phone,
    transport_mode: row.transport_mode,
    route_color: row.route_color,
    stop_type: row.stop_type,
    fill_percent: row.fill_percent,
    email: row.email,
    opening_hours: row.opening_hours,
  };
}
