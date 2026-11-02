import { Places } from '../../db/entities/Places.entity';
import type { PlacesRepository } from '../../db/repositories/Places.repository';
import { getCountryFromCoords } from '../../utils/country-borders';
import { DomainError } from '../common/domain-error';
import { PlaceImportService } from '../place-import/place-import.service';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable, Logger } from '@nestjs/common';
import type { ListPreviewPlace, PlaceListPreviewResponse } from '@trek/shared';

/** Reads a shared list and classifies each place against the trip's places. Never writes. */
@Injectable()
export class PlacesListPreviewService {
  private readonly logger = new Logger(PlacesListPreviewService.name);

  constructor(
    private readonly placeImport: PlaceImportService,
    @InjectRepository(Places) private readonly placesRepo: PlacesRepository,
  ) {}

  async previewGoogleList(tripId: number, url: string): Promise<PlaceListPreviewResponse> {
    const read = await this.readList(url);
    if ('error' in read) throw new DomainError(read.status, read.error);
    if ('directions' in read) return { kind: 'directions' };

    const targets = (await this.placesRepo.listAllForTrip(tripId)).map((row) => ({
      id: row.id,
      name: row.name,
      lat: row.lat,
      lng: row.lng,
      google_place_id: row.google_place_id,
      google_ftid: row.google_ftid,
      route_geometry: row.route_geometry,
    }));

    const places: ListPreviewPlace[] = read.places.map((p, index) => ({
      key: String(index),
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      notes: p.notes,
      googleFtid: p.googleFtid,
      country: getCountryFromCoords(p.lat, p.lng),
      ...this.placeImport.classifyListPlace(p, targets),
    }));
    return { kind: 'list', listName: read.listName, places };
  }

  /** A network failure or timeout gets the direct import's 400 wording, not a 500. */
  private async readList(url: string): ReturnType<PlaceImportService['readGoogleList']> {
    try {
      return await this.placeImport.readGoogleList(url);
    } catch (err: unknown) {
      if (err instanceof DomainError) throw err;
      this.logger.error(`Google list preview error: ${err instanceof Error ? err.message : String(err)}`);
      throw new DomainError(400, 'Failed to import Google Maps list. Make sure the list is shared publicly.');
    }
  }
}
