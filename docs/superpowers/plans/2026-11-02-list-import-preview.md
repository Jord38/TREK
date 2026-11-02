# Google List Import Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pasted Google Maps list opens a preview grouped by country, with each place sorted into New / To check / Already in your trip, and only what is ticked gets imported.

**Architecture:** A pure matcher module on the server classifies each list place against the trip's places. A preview endpoint reads the list once (existing provider), adds a country per place from TREK's offline borders, and returns the classified places without writing. The client holds the selection and sends back exactly the ticked places, the matches to link, and the pins to move; a commit endpoint writes all of it in one transaction. Desktop dialog and phone sheet share one hook.

**Tech Stack:** NestJS 11 + Kysely/SQLite (server), React + Vitest + Testing Library (client), zod schemas in `shared/`.

**Spec:** `docs/superpowers/specs/2026-11-02-list-import-preview-design.md` (read it first; its "Settled after the builder check" section is binding).

## Global Constraints

- Branch `feat/list-import-preview` (based on tag `v5.1.0`). Conventional commits, no Claude attribution, author is the repo's configured user.
- Node runs only in Docker: every command below is run as
  `docker run --rm -e NODE_OPTIONS=--max-old-space-size=5000 -v ~/code/trek:/app -w /app/<workspace> node:24-alpine <cmd>`
  (`<workspace>` = `shared`, `server` or `client`). After changing `shared/src`, run `npm run build` in `shared` before server or client tests.
- The new matching applies only to the Google list preview. GPX, KML, Naver, directions links, the MCP `import_list` tool and `POST .../import/google-list` keep today's behaviour and tests untouched.
- Nothing is written to the trip before the commit request. Cancel = no change.
- Tests never use Jord's real list or trip: made-up names and coordinates that mirror the spec's cases.
- Copy in English and Dutch only (`shared/src/i18n/en|nl/places.ts`); other locales fall back.
- Every ratchet stays green; run them per task for the workspace you touched:
  - server: `typecheck`, `typecheck:tests`, `lint:warnings`, `lint:format`, `lint:size`, `lint:strict`, `lint:boundaries`, `lint:tx`, `lint:test-sql`, `lint:test-mocks`, `lint:test-new-service`, `lint:query-api`, `lint:service-http`, `lint:response-contracts`
  - client: `typecheck`, `lint:warnings`, `lint:format`, `lint:size`, `lint:pairs`, `lint:dup`, `lint:layers`, `lint:offline`, `lint:rtl`, `lint:skips`, `lint:strict`, `theme:lint`, `lint:i18n-keys`
  - shared: `typecheck`, `lint`, `format:check`, `test`
  The full-repo eslint (`lint:warnings`) can run out of memory on this Mac; if it does, compare per-rule warning counts of the changed files against `v5.1.0` instead and report that.
- `server/src/nest/places/places.service.ts` and `Places.repository.ts` are near their size baselines: new logic goes in new files, and the changes to those two files stay a few lines.

## Review Focus

1. A list place whose coordinates fall in no country (open sea, dropped pin) appears under "Other" and can still be imported. Test in Task 2.
2. Trip places without coordinates or that are tracks (`route_geometry` set) never match by distance and never crash the matcher. Test in Task 1.
3. Two list places matching the same trip place: both show as Already; linking attaches the id once and the commit does not fail. Test in Task 3.
4. A trip place deleted (by someone else) between preview and commit: its link or pin move is skipped and reported, the rest of the import still lands. Test in Task 3.
5. A pasted directions link or a short link that resolves to directions falls back to today's direct import instead of an error. Test in Task 2 (server answer) and Task 4 (client fallback).

---

### Task 1: The matcher

**Files:**
- Create: `server/src/nest/place-import/list-match.ts`
- Test: `server/tests/unit/nest/place-import/list-match.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface MatchTarget { id: number; name: string | null; lat: number | null; lng: number | null;
    google_place_id: string | null; google_ftid: string | null; route_geometry: string | null }
  export interface MatchCandidate { name: string; lat: number; lng: number; googleFtid: string | null }
  export type MatchReason = 'id' | 'name' | 'core' | 'core-far' | 'part'
  export type HintKind = 'same-name-far' | 'next-to'
  export interface ListMatch { bucket: 'new' | 'check' | 'existing';
    match: { placeId: number; name: string; distanceM: number | null; reason: MatchReason } | null;
    hint: { kind: HintKind; placeId: number; name: string; distanceM: number } | null }
  export function normalizeName(name: string): string
  export function coreName(name: string): string
  export function matchListPlace(candidate: MatchCandidate, targets: readonly MatchTarget[]): ListMatch
  ```

- [ ] **Step 1: Write the failing tests** (`describe('list matching')`), one `it` per row of the spec's rule table plus the edge cases, with made-up data, e.g.:
  - `normalizeName('MR.HIRO CAR STUDIO') === normalizeName('Mr. Hiro Car Studio')`; `normalizeName('Fuji Motor Sports Museum') === normalizeName('FUJI Motorsports Museum')`; an all-CJK name normalizes to its NFKC form without spaces/punctuation (non-empty).
  - `coreName("Grandfather's bar") === coreName("Grandfather's")`; `coreName('Voyager Lounge Shinsaibashi') === coreName('Voyager Lounge 心斎橋')`.
  - id match (`googleFtid` equals a target's `google_ftid`) → `existing`, reason `id`, even 50 km apart.
  - equal normalized names 260 m apart → `existing`/`name`; 2.5 km apart → not `existing` by name; equal normalized 400 km apart → `new` with hint `same-name-far`.
  - equal core names 9 m apart → `existing`/`core`; 1.2 km apart → `check`/`core-far`; 3.5 km apart → `new`.
  - core contained ("Round One Stadium" vs "Round One"), 200 m → `check`/`part`; same pair 800 m → `new`; containment with a 3-character core never matches.
  - unrelated names 10 m apart → `new` with hint `next-to`; 40 m → no hint.
  - targets with `lat`/`lng` null or `route_geometry` set are skipped for every distance rule but still match by id; an empty target list gives `new`, no hint.
  - when several targets qualify, the strongest bucket wins (`existing` over `check`), then the nearest.

- [ ] **Step 2: Run them to see them fail**
  Run: `npx vitest run tests/unit/nest/place-import/list-match.test.ts` (server). Expected: FAIL, module not found.

- [ ] **Step 3: Implement `list-match.ts`.** Distances by haversine in metres; thresholds and the generic-word list from the spec as named constants (`SAME_NAME_MAX_M = 2000`, `SAME_CORE_MAX_M = 1000`, `CHECK_CORE_MAX_M = 3000`, `PART_MAX_M = 500`, `PART_MIN_CHARS = 4`, `NEXT_TO_MAX_M = 25`). Evaluate every target, keep the best by (bucket rank, then distance). No I/O, no imports from Nest.

- [ ] **Step 4: Run the tests** — Expected: PASS. Then the server ratchets from Global Constraints.

- [ ] **Step 5: Commit** — `feat(places): match Google list places against the trip`

### Task 2: Preview endpoint

**Files:**
- Create: `shared/src/place/place-list-preview.schema.ts` (export from the place barrel the way `place.schema.ts` is)
- Create: `server/src/nest/places/places-list-preview.service.ts`
- Modify: `server/src/nest/places/places.controller.ts` (one route), `server/src/nest/places/places.module.ts` (provider)
- Test: `shared/src/place/place-list-preview.schema.spec.ts`, `server/tests/unit/nest/places-list-preview.service.test.ts`, `server/tests/integration/places.test.ts` (new `PLACE-028*` cases)

**Interfaces:**
- Consumes: `matchListPlace`, `MatchTarget` (Task 1); `PlaceImportService.readGoogleList(url)`; `PlacesRepository.listAllForTrip(tripId)`; `getCountryFromCoords(lat, lng)` from `server/src/utils/country-borders.ts`.
- Produces (shared, zod + inferred types):
  ```ts
  placeListPreviewRequestSchema = { url: string (min 1) }
  ListPreviewPlace = { key: string; name: string; lat: number; lng: number; notes: string | null;
    googleFtid: string | null; country: string | null /* ISO 3166-1 alpha-2 */ } & ListMatch
  placeListPreviewResponseSchema =
    { kind: 'list'; listName: string; places: ListPreviewPlace[] } | { kind: 'directions' }
  ```
  Route: `POST /api/trips/:tripId/places/import/google-list/preview`, same `requireTrip` + `requireEdit` gates as the import, 200 on success, the provider's error status and message on a read error. `key` = the place's index in the list as a string.

- [ ] **Step 1: Write the failing tests**
  - schema spec: accepts a `kind: 'list'` response with one place of each bucket; accepts `{ kind: 'directions' }`; rejects a place with `bucket: 'maybe'`.
  - service unit test (provider and repo faked): classifies a list against trip rows (one each of existing/check/new), sets `country` from coordinates (a Tokyo point → `'JP'`, a Seoul point → `'KR'`), sets `country: null` for a point in the open Pacific (Review Focus 1), skips nothing, writes nothing (repo has no write calls), and returns `{ kind: 'directions' }` when the provider answers with a directions redirect (Review Focus 5).
  - integration `PLACE-028`: unauthenticated → 401; viewer without edit rights → 403; editor gets 200 with `kind: 'list'`; empty `url` → 400.
- [ ] **Step 2: Run them to see them fail** (shared spec, service test, integration file).
- [ ] **Step 3: Implement** the schema, the service (`previewGoogleList(tripId: string, url: string): Promise<PlaceListPreviewResponse>`), the route and the provider registration.
- [ ] **Step 4: Run tests and ratchets** — PASS; regenerate anything the response-contract ratchet asks for, never hand-edit generated files.
- [ ] **Step 5: Commit** — `feat(places): preview a Google list before importing it`

### Task 3: Commit endpoint

**Files:**
- Create: `server/src/nest/places/places-list-import.service.ts`, `server/src/nest/places/google-list-insert-row.ts`
- Modify: `shared/src/place/place-list-preview.schema.ts` (commit schemas), `server/src/nest/places/places.controller.ts` (one route), `server/src/nest/places/places.module.ts`, `server/src/nest/places/places.service.ts` (use the extracted row builder in `storeGooglePlaces`; make `enrichImportedList` public)
- Test: `server/tests/unit/nest/places-list-import.service.test.ts`, `server/tests/integration/places.test.ts` (`PLACE-029*`)

**Interfaces:**
- Consumes: `ListImportOptions`, `PlacesService.broadcast`, `PlacesService.enrichImportedList`, `PlacesRepository.insertPlace | findInTrip | backfillFtid | updatePlace | findWithTagsAndRatings`, the unit of work used by `storeGooglePlaces`.
- Produces:
  ```ts
  googleListInsertRow(tripId: number, p: { name: string; lat: number; lng: number; notes: string | null; googleFtid: string | null }): Parameters<PlacesRepository['insertPlace']>[0]
  placeListCommitRequestSchema = { listName: string; enrich?: boolean;
    places: { name: string; lat: number; lng: number; notes: string | null; googleFtid: string | null }[];
    link: { placeId: number; googleFtid: string }[];
    movePin: { placeId: number; lat: number; lng: number; googleFtid: string | null }[] }
  placeListCommitResponseSchema = { places: Place[]; count: number; listName: string;
    linked: number; moved: number; stale: number }
  commitGoogleList(tripId: string, body: PlaceListCommitRequest, opts: ListImportOptions): Promise<PlaceListCommitResponse>
  ```
  Route: `POST /api/trips/:tripId/places/import/google-list/commit` (201), same gates; broadcasts `place:created` per new place and `place:updated` per moved pin, with the request's `x-socket-id`.

- [ ] **Step 1: Write the failing tests**
  - every sent place is inserted as sent, with no dedup (a place whose name already exists in the trip is still inserted: the user ticked it);
  - `link` attaches `google_ftid` only to a trip place that has none, and two links to the same place attach once and count once (Review Focus 3);
  - `movePin` sets lat/lng (and the ftid when given) and leaves every other column of that place unchanged;
  - a `placeId` from another trip or one that no longer exists is not touched and counts in `stale`, while the places still insert (Review Focus 4);
  - all writes run in one transaction: a failing insert leaves no link or pin move behind;
  - integration `PLACE-029`: 401 / 403 / 201 with counts; `places: []` with one `link` is valid and returns `count: 0, linked: 1`.
  - `storeGooglePlaces` keeps its existing tests green after it switches to `googleListInsertRow`.
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.** Enrichment runs after the transaction exactly as `importGoogleList` does (`void enrichImportedList(...)` on the created places when `enrich`).
- [ ] **Step 4: Run tests and ratchets** — PASS, including `lint:tx` and `lint:size` for `places.service.ts`.
- [ ] **Step 5: Commit** — `feat(places): import the chosen places of a previewed Google list`

### Task 4: Client API and the shared hook

**Files:**
- Modify: `client/src/api/client.ts` (`placesApi.previewGoogleList`, `placesApi.commitGoogleList`), `client/src/api/client.surface.test.ts`
- Create: `client/src/components/Planner/useListImportPreview.ts`
- Modify: `client/src/components/Planner/useListImport.ts` (Google goes through the preview; Naver unchanged)
- Test: `client/src/components/Planner/useListImportPreview.test.ts`, `client/src/components/Planner/useListImport.test.ts`

**Interfaces:**
- Consumes: the shared request/response types (Tasks 2 and 3); `countryNamer(language)` from `client/src/utils/countryName.ts`.
- Produces:
  ```ts
  useListImportPreview(preview: PlaceListPreviewResponse & { kind: 'list' } | null): {
    countries: { code: string | null; name: string; count: number }[]  // sorted by count desc, null last ("Other")
    selectedCountries: ReadonlySet<string | null>; toggleCountry(code: string | null): void
    rows: { new: ListPreviewPlace[]; check: ListPreviewPlace[]; existing: ListPreviewPlace[] } // selected countries only
    ticked: ReadonlySet<string>; toggle(key: string): void
    pinMoves: ReadonlySet<string>; togglePinMove(key: string): void
    counts: { inCountries: number; new: number; check: number; existing: number; toImport: number }
    toCommit(listName: string, enrich: boolean): PlaceListCommitRequest }
  ```
  `useListImport` gains `previewData`, `previewLoading`, `handlePreview()`, `handleCommit()` and `backToLink()`; `handleImport` for Google now calls `handlePreview`.
- Rules the tests pin (from the spec): no country preselected; `new` rows start ticked, `check` and `existing` unticked; hints never untick; a pin move on a `check` row moves it to `existing` and is reversible; `toCommit` sends ticked rows as `places`, untouched `existing` matches that have a `googleFtid` as `link`, and pin moves as `movePin`; a ticked `existing` row is imported and not linked.
- [ ] **Step 1: Write the failing tests** for each rule above, plus: `toImport` follows ticks; switching countries off drops their rows from `toCommit`; a `{ kind: 'directions' }` preview answer makes `useListImport` run today's `importGoogleList` and its existing toast/undo path (Review Focus 5); a commit registers one undo step that deletes the created places, as today.
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement** the API calls (60 s timeout like the existing import), the hook and the `useListImport` changes. Keep Naver exactly as is.
- [ ] **Step 4: Run tests and client ratchets** — PASS.
- [ ] **Step 5: Commit** — `feat(places): hold a Google list preview and its choices on the client`

### Task 5: Desktop dialog

**Files:**
- Create: `client/src/components/Planner/ListImportPreview.tsx`
- Modify: `client/src/components/Planner/PlacesSidebarListImportModal.tsx`, `shared/src/i18n/en/places.ts`, `shared/src/i18n/nl/places.ts`
- Test: `client/src/components/Planner/ListImportPreview.test.tsx`, the modal's existing test file

**Interfaces:**
- Consumes: `useListImport` / `useListImportPreview` (Task 4).
- Produces: `ListImportPreview` (props: the preview hook's return value, `t`, `language`) and the i18n keys under `places.listPreview.*` (title line, summary, bucket headings, reasons, hints, pin action, "Other", import button with count). Copy wording from the spec's "What he sees"; Dutch alongside.
- [ ] **Step 1: Write the failing tests**: chips show name and count and toggle; the summary line reads the counts; the three groups appear in the order To check, New, Already (collapsed until opened); each row's checkbox toggles; a reason line shows the matched place's name and distance; "Use Google's location for mine" appears only on `check` rows with a match and marks the row; the import button shows the count and is disabled at 0; Cancel closes without a commit call.
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement** with the surrounding Planner components and theme tokens (no raw colours or text sizes; `theme:lint` and `lint:rtl` stay green).
- [ ] **Step 4: Run tests and client + shared ratchets** — PASS.
- [ ] **Step 5: Commit** — `feat(places): show the Google list preview in the import dialog`

### Task 6: Phone sheet, docs, fork notes

**Files:**
- Create: `client/src/mobile/screens/trip/sheets/ImpListPreview.tsx`
- Modify: `client/src/mobile/screens/trip/sheets/ImpListStep.tsx`, `client/scripts/feature-pairs.json` (add `useListImportPreview.ts` to the list-import pair's hooks and the new desktop/phone files), `wiki/Places-and-Search.md` (Importing multiple places), `FORK.md` on `jord` after the merge
- Test: `client/tests/unit/mobile/...` beside the existing ImpListStep tests (find them with `grep -rl ImpListStep client/tests client/src`)

**Interfaces:**
- Consumes: Tasks 4 and 5 (same hook, same i18n keys).
- [ ] **Step 1: Write the failing tests**: the phone step shows the chips, the groups and the import button with count; committing calls `onDone`; a directions answer still imports directly.
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement** with the mobile components already used in `ImpListStep` (`MChip`, `MToggle`, `FormSheetFooter`); update the wiki section to describe the preview, the buckets and that other imports are unchanged.
- [ ] **Step 4: Run the full client suite once** (`npx vitest run --maxWorkers=4`) and every ratchet in all three workspaces — PASS.
- [ ] **Step 5: Commit** — `feat(places): Google list preview on the phone`
