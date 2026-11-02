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
export const listMatchHintKindSchema = z.enum(['same-name-far', 'next-to']);

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
