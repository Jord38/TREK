import type { PlacesRepository } from '../../db/repositories/Places.repository';

export interface GoogleListInsertSource {
  name: string;
  lat: number;
  lng: number;
  notes: string | null;
  googleFtid: string | null;
}

/** The columns a Google list place is stored with; every other one takes its default. */
export function googleListInsertRow(
  tripId: number,
  p: GoogleListInsertSource,
): Parameters<PlacesRepository['insertPlace']>[0] {
  return {
    trip_id: tripId,
    name: p.name,
    description: null,
    lat: p.lat,
    lng: p.lng,
    address: null,
    category_id: null,
    price: null,
    currency: null,
    place_time: null,
    end_time: null,
    duration_minutes: 60,
    notes: p.notes,
    image_url: null,
    google_place_id: null,
    google_ftid: p.googleFtid,
    osm_id: null,
    amap_poi_id: null,
    website: null,
    phone: null,
    transport_mode: 'walking',
    route_geometry: null,
    route_color: null,
    stop_type: null,
    fill_percent: null,
    email: null,
    opening_hours: null,
  };
}
