import { Places } from '../../db/entities/Places.entity';
import type { PlacesRepository } from '../../db/repositories/Places.repository';
import { getCountryFromCoords } from '../../utils/country-borders';
import { DomainError } from '../common/domain-error';
import { PlaceImportService } from '../place-import/place-import.service';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable } from '@nestjs/common';
import type { ListPreviewPlace, PlaceListPreviewResponse } from '@trek/shared';

/** Reads a shared list and classifies each place against the trip's places. Never writes. */
@Injectable()
export class PlacesListPreviewService {
  constructor(
    private readonly placeImport: PlaceImportService,
    @InjectRepository(Places) private readonly placesRepo: PlacesRepository,
  ) {}

  async previewGoogleList(tripId: string, url: string): Promise<PlaceListPreviewResponse> {
    const read = await this.placeImport.readGoogleList(url);
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
}
