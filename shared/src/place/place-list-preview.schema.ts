import { placeSchema } from './place.schema';

import { z } from 'zod';

/**
 * Preview of a shared Google Maps list: each place classified against the trip's
 * existing places, before anything is imported. Mirrors ListMatch in
 * server/src/nest/place-import/list-match.ts (shared cannot import from server).
 */

export const placeListPreviewRequestSchema = z.object({
  url: z.string().min(1),
});
export type PlaceListPreviewRequest = z.infer<typeof placeListPreviewRequestSchema>;

export const listMatchBucketSchema = z.enum(['new', 'check', 'existing']);
export const listMatchReasonSchema = z.enum(['id', 'name', 'core', 'core-far', 'part']);
export const listMatchHintKindSchema = z.enum(['same-name-far', 'similar-nearby', 'next-to']);

export const listMatchSchema = z.object({
  bucket: listMatchBucketSchema,
  match: z
    .object({
      placeId: z.number(),
      name: z.string(),
      distanceM: z.number().nullable(),
      reason: listMatchReasonSchema,
    })
    .nullable(),
  hint: z
    .object({
      kind: listMatchHintKindSchema,
      placeId: z.number(),
      name: z.string(),
      distanceM: z.number(),
    })
    .nullable(),
});
export type ListMatchDto = z.infer<typeof listMatchSchema>;

export const listPreviewPlaceSchema = z
  .object({
    /** The place's index in the list, as a string. */
    key: z.string(),
    name: z.string(),
    lat: z.number(),
    lng: z.number(),
    notes: z.string().nullable(),
    googleFtid: z.string().nullable(),
    /** ISO 3166-1 alpha-2, null when the point lies outside every country. */
    country: z.string().nullable(),
  })
  .merge(listMatchSchema);
export type ListPreviewPlace = z.infer<typeof listPreviewPlaceSchema>;

export const placeListPreviewResponseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('list'),
    listName: z.string(),
    places: z.array(listPreviewPlaceSchema),
  }),
  z.object({ kind: z.literal('directions') }),
]);
export type PlaceListPreviewResponse = z.infer<typeof placeListPreviewResponseSchema>;

/** The create route's limits (`validateLengths`), so a list import cannot write longer text than a hand-made place. */
export const LIST_COMMIT_NAME_MAX = 200;
export const LIST_COMMIT_NOTES_MAX = 2000;
export const LIST_COMMIT_MAX_ITEMS = 1000;

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

const commitPlaceSchema = z.object({
  name: z.string().min(1).max(LIST_COMMIT_NAME_MAX),
  lat: latitude,
  lng: longitude,
  notes: z.string().max(LIST_COMMIT_NOTES_MAX).nullable(),
  googleFtid: z.string().nullable(),
});

/**
 * What the preview's Import sends back: the ticked places, the matches to link, the pins to move.
 *
 * The global 100 kB JSON body limit (server bootstrap) is usually the tighter cap: a request
 * of 1000 places with long notes is refused with 413 before it reaches this schema.
 */
export const placeListCommitRequestSchema = z.object({
  listName: z.string().max(LIST_COMMIT_NAME_MAX),
  enrich: z.boolean().optional(),
  places: z.array(commitPlaceSchema).max(LIST_COMMIT_MAX_ITEMS),
  /** Existing places that receive the Google id of the list place they matched. */
  link: z.array(z.object({ placeId: z.number().int(), googleFtid: z.string().min(1) })).max(LIST_COMMIT_MAX_ITEMS),
  /** Existing places whose pin moves to Google's location. */
  movePin: z
    .array(
      z.object({
        placeId: z.number().int(),
        lat: latitude,
        lng: longitude,
        googleFtid: z.string().nullable(),
      }),
    )
    .max(LIST_COMMIT_MAX_ITEMS),
});
export type PlaceListCommitRequest = z.infer<typeof placeListCommitRequestSchema>;

export const placeListCommitResponseSchema = z.object({
  places: z.array(placeSchema),
  count: z.number().int(),
  listName: z.string(),
  linked: z.number().int(),
  moved: z.number().int(),
  /** Link or pin-move targets that were gone or belong to another trip. */
  stale: z.number().int(),
});
export type PlaceListCommitResponse = z.infer<typeof placeListCommitResponseSchema>;
