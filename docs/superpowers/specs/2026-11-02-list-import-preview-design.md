# Google list import: preview, country filter, smart matching

Fork feature for trek.jord.cloud. Branch `feat/list-import-preview`, based on the
`v5.1.0` tag, merged into `jord` when done (see FORK.md).

## Why

Jord keeps one big Google Maps "Want to go" list (105 places across Japan, South
Korea, China, Germany, Indonesia and more) and plans one trip per country. Today
**List Import** brings in the whole list at once: no preview, no choice. He also
added some of the list's places to the trip by hand already, and today's
duplicate check only catches exact name matches, so a second import would add
"Mr. Hiro Car Studio" next to his "MR.HIRO CAR STUDIO".

Success: paste the list link, tick Japan, see which places are new and which he
already has, and import only the new Japanese ones, in one dialog, without
cleaning up afterwards.

## Goals

1. **Preview before import.** Pasting a Google list link no longer imports
   straight away. It shows the list's places first; nothing is written until he
   presses Import.
2. **Country filter.** The preview groups the places by country with a count per
   country ("Japan 47, South Korea 23, …"). He picks one or more countries; only
   their places are offered. The country comes from each place's coordinates, not
   its address (the list's Japanese addresses are often in local format).
3. **Smart matching** against the places already in the trip, in three buckets:
   - **Already in your trip**: confident matches. Left out, shown collapsed with
     what each matched and how far apart the pins are.
   - **To check**: likely the same place but not sure. Left out unless ticked,
     each with the reason.
   - **New**: ticked. A new place can carry a hint when something in the trip is
     related but is not a match (same name in another city, a similarly named
     place nearby).
4. **Learn from matches.** A confidently matched existing place gets the list
   place's Google feature id attached, so the next import recognises it exactly
   instead of by guessing.
5. **Fix a wrong pin.** On a "To check" row, an explicit "Use Google's location
   for mine" action moves the existing place's pin to the list's location (and
   attaches the id). Only ever on that click.
6. **Desktop and mobile.** Same flow in the places column dialog and in the
   phone's import sheet, through one shared hook (the repo's `lint:pairs` rule).

## Non-goals

- **Export.** Wanted eventually, undecided what it means; not in this build.
  Nothing here should make it harder later.
- Changing or writing to the Google list itself (Google offers no way to).
- Naver lists and Google directions links: they keep today's direct import.
  The builder may route Naver lists through the same preview if it falls out of
  the shared code for free, but it is not required.
- Matching across names written in different scripts by transliteration
  (心斎橋 vs Shinsaibashi). The rule below handles the real cases through the
  Latin part of the name and distance.

## Anti-goals (a failure even if it works)

- **Never silently drop or merge.** Every place the list holds for the chosen
  countries is visible in one of the three buckets, and each one can be ticked
  or unticked before importing.
- **Never change an existing place without a reason shown to him.** Attaching a
  Google id on a confident match is the only automatic change; moving a pin needs
  the explicit click.
- No new outbound calls just to classify: countries come from TREK's offline
  borders (`getCountryFromCoords` in `server/src/utils/country-borders.ts`), the
  list is fetched once as today.

## The matching rule (decided, from a test on the real data)

Measured on the real list against the real Japan trip (15 hand-added places,
none with a Google id, all added through TREK's own search): Google and TREK's
search put the same place 9 m to 562 m apart, so a fixed "nearby" distance does
not work. The stronger the name match, the further apart the pins may be.

Names are compared in two forms:

- **normalized**: NFKC, lowercase, every character outside `a-z0-9` removed
  (so "MR.HIRO CAR STUDIO" = "Mr. Hiro Car Studio", "Fuji Motor Sports Museum"
  = "FUJI Motorsports Museum"). A name with no Latin letters at all is compared
  by its NFKC form with spaces and punctuation removed instead.
- **core**: the normalized name after dropping generic words (the, bar, cafe,
  restaurant, shop, store, lounge, club, stadium and city/area names such as
  tokyo, osaka, shibuya, shinsaibashi, japan). "Grandfather's bar" and
  "Grandfather's" share the core "grandfathers".

In order, first hit wins:

| Condition | Bucket |
|---|---|
| A provider id matches (google feature id or place id), as today | Already in trip |
| Normalized names equal, pins within 2 km | Already in trip |
| Core names equal, pins within 1 km | Already in trip |
| Core names equal, pins 1 km to 3 km apart | To check ("same name, N km apart, maybe your pin is off") |
| One core contains the other (shorter one at least 4 characters and at least 60% of the longer), within 500 m | To check |
| One core contains the other but covers less than 60% of it, within 500 m | New, with hint ("similar name to your <name>, N m away") |
| Normalized names equal but more than 3 km apart | New, with hint ("your trip has one in <place>, N km away") |
| Unrelated names, pins within 25 m | New, with hint ("right next to your <name>") |
| Otherwise | New |

On the real data this gives 10 confident matches (CATS BAR, The V, Mr. Hiro Car
Studio, Grandfather's bar, Fuji Motor Sports Museum, Fuji Speedway, Ebisu
Circuit, Suzuka Circuit, Umihotaru PA, Kamakura), 1 to check (Voyager Lounge,
same core name, 1.2 km apart: his pin is likely wrong), and correct hints for
Rockrock (his trip's "Rock Rock" is in Tokyo, the list's in Osaka) and Round1
Stadium Sennichimae (not his "Round1", 208 m away). No false match.

Thresholds and the generic-word list are the builder's to tune, as long as the
cases above keep their bucket. Tests must not use Jord's own list: the repo is
public. Build fixtures that mirror these cases with made-up names and
coordinates.

## What he sees

The dialog (mockup reviewed in the brainstorm; desktop shown, mobile is the same
content in the import sheet):

1. The link field as today, plus the list's name and place count once read.
2. Country chips with counts, from the place coordinates; unknown or unmatched
   coordinates go under "Other". Selecting a chip offers its places; several can
   be selected. No country is preselected (my call, below).
3. A summary line: "47 in Japan · 36 new · 10 already in your trip · 1 to check".
4. The buckets: To check first (it needs his attention), then New, then Already
   in your trip collapsed. Every row has its checkbox; hints and match reasons
   sit under the name in a smaller line.
5. Cancel, and "Import N places" with N following the ticks.

Today's "Enrich on import" option stays, and applies to what gets imported.
Importing keeps today's behaviour after the click: places are created through
the existing import path, broadcast to other open sessions, and undoable with
**Undo** in the days column.

## Constraints

- TREK's repo rules: tests for every behaviour above (server and client), all
  ratchets green (eslint warnings, size, format, theme, rtl, pairs, dup, skips,
  strict, i18n keys), no growth of files past their size baseline.
- Node only runs in Docker on Jord's Mac.
- Copy in English and Dutch; other locales fall back to English.
- Keep it upstreamable: no instance-specific paths or names in the code, so it
  can later be offered to TREK (pitched in their Discord first).

## Left to the builder

- API shape: e.g. a preview endpoint returning the list's places with country
  and bucket per place, and the import endpoint accepting the chosen subset.
  Re-fetching the list at import time vs passing the parsed places back is the
  builder's call, as long as what gets imported is exactly what was ticked.
- Where the matching code lives and how it composes with today's
  `isPlaceDuplicate` / `dedupSetOf` in `server/src/nest/places/places.helpers.ts`.
- Exact layout and component reuse in the dialog and the mobile sheet,
  following the surrounding TREK components.
- What Undo covers for the attached ids and moved pins (imported places must
  be undoable as today).

## Settled after the builder check

- **Everything waits for Import, the pin fix included.** "Use Google's location
  for mine" marks the row as "pin will move" (reversible on the row) and moves it
  to Already in your trip; the move is sent with the Import request and applied
  in the same transaction as the new places. Cancel leaves the trip untouched.
- **Attaching the Google id happens at Import, for matches that stay unticked.**
  The client sends which existing place each untouched match belongs to; the
  server attaches the id then. Nothing is attached on Cancel.
- **Ticking an Already-in-trip row imports a second copy**, his explicit choice,
  and attaches no id to the existing place.
- **The new rule applies only to the Google list preview.** GPX, KML, Naver,
  directions links, the MCP `import_list` tool and the existing direct endpoint
  keep today's check (`isPlaceDuplicate` / `findDuplicatePlace`) and behaviour,
  so no other import changes under anyone's feet. The new matcher is its own
  module, so it can replace the old check later if that proves right.

## Calls I made (Jord to check)

- No country preselected; he picks. (Alternative: preselect the country the
  trip's existing places are in.)
- "To check" rows start unticked.
- Hints never untick a new place.
- Naver lists and directions links are out of scope.
- The four points under "Settled after the builder check".
