# Fork changelog: what's new dialog, page and build-aware update notice

Fork feature for trek.jord.cloud. Branch `feat/fork-changelog`, based on the
`v5.1.0` tag, merged into `jord` when done (see FORK.md on `jord`).

## Why

Jord adds features to his TREK fork (place names on the Atlas, the welcome video,
the Google list import with a country filter) and wants his friends to notice
when something new lands, the way his AI trader shows a changelog. Today they
can't: TREK's own "new version, reload" notice compares version numbers, and
every fork image reports the upstream version (`5.1.0`) on purpose, because
plugins check their host range against it and TREK's places issuer binds its
registration dialect to it. And TREK's release notes only describe upstream.

Success: after a deploy, a friend who opens TREK sees a small dialog listing what
was added since they last looked, newest first, and can open a page with the
whole history. A page left open during the deploy offers a reload first.

## Goals

1. **Build identity.** Each fork image carries a build name next to the version,
   `<version>-jord.<run>` (e.g. `5.1.0-jord.3`), from the image build (the
   workflow already computes this tag). The version itself (`runningVersion()`,
   `APP_VERSION`) stays the upstream version.
2. **Update notice that sees our deploys.** The server sends the build name to
   connected clients in the same `welcome` message that carries the version
   today (server/src/nest/realtime/realtime.gateway.ts), and in the app config
   the client reads at launch. The client compares build names when both sides
   have one, versions otherwise, so TREK's existing `NewVersionNotice` and launch
   handover fire for a new fork build exactly as they do for an upstream release.
3. **A fork changelog** as a data file in the repo: entries with an id, a date,
   a title and items (`added` | `changed` | `fixed`, one sentence each), English
   only. Validated by a schema and a test, shipped in the image, editable without
   touching code.
4. **What's new dialog.** On a user's next visit, every changelog entry they have
   not seen yet appears in one dialog, newest first, with a link to the full
   page. Closing it marks all shown entries seen for that user, on every device
   (server-side, like TREK's own notices). Built on TREK's system notice modal.
5. **What's new page.** All entries, newest first, reachable from the dialog and
   from Settings → About, which also shows the build name.

## Non-goals

- Upstream's release history: TREK's own release notes notice keeps doing that.
- Translating entries. The dialog and page chrome are in English and Dutch.
- Push notifications, email, or anything outside the app.
- An admin UI for writing entries: Jord's changelog is the JSON file in git.

## Anti-goals

- Never change the version plugins and the places issuer see.
- A brand-new user must not be shown entries from before they joined. If their
  welcome video is still undismissed, it comes first (higher priority) in the
  same modal.
- Never nag: an entry a user closed never comes back for that user.

## Decided

- Entry shape: `{ id: string, date: 'YYYY-MM-DD', title: string, items: { kind: 'added' | 'changed' | 'fixed', text: string }[] }`; ids unique and stable (a date plus a slug).
- Who sees an entry in the dialog: users whose account existed before the
  entry's date. Logins do not matter: a remembered session lasts up to 30 days,
  so someone who logged in once and kept using TREK still gets every later entry.
  Entries dated before the user's account was created never show in the dialog
  (they are on the page).
- Several missed entries: all of them, newest first, in one dialog (Jord's
  answer). Whether that is one notice with the entries stacked or one notice per
  entry paged through TREK's existing multi-notice modal is the builder's call,
  as long as the reader sees them newest first and one close dismisses all shown.
- The first entry covers what is on `jord` today: the Atlas place names switch,
  the welcome video for new users, and the Google list import with the country
  filter and duplicate check (once that ships).
- Fork-only parts live in clearly named files (e.g. `fork-changelog`), so the
  build-identity part can be offered upstream on its own.

## Settled after the builder check (my calls)

- **Dates are whole UTC days.** An entry's `date` is the day it is deployed. A
  user sees it in the dialog when their account was created on an earlier UTC
  day; a same-day signup does not (they joined after or around the deploy and
  get the welcome video). The condition context gains the user's `created_at`.
- **"Seen" uses TREK's existing dismissals.** The notice registry gains one
  notice per changelog entry, generated from the JSON when the module loads
  (id `fork-changelog:<entry id>`), so `dismiss()` accepts them and nothing new
  is stored; no migration. Users who never qualified simply never get one.
- **Copy for the dialog and page chrome: English and Dutch only**; other locales
  fall back to English, as with the welcome video.
- **First deploy of this feature:** open pages still run a bundle without a
  build name, so they get no reload prompt that one time; the dialog appears on
  their next load. Acceptable.
- **No login condition.** Only the account's creation day decides (Jord: a
  friend who logged in once and stayed signed in must still get new entries).

## Constraints

- Same repo rules as the other fork features: tests for every behaviour, all
  ratchets green (eslint warning counts, size, format, theme, rtl, pairs, dup,
  skips, strict, i18n keys, server boundaries/tx/response contracts), no file
  past its size baseline.
- Node only runs in Docker on Jord's Mac.
- The image workflow (`.github/workflows/jord-image.yml` on `jord`) passes the
  build name as a build argument; the Dockerfile writes it where the server and
  the client bundle read it, the way `APP_VERSION` is handled today.

## Left to the builder

- Where the JSON lives and how it reaches the server and client (bundled import
  vs read from disk at runtime like the wiki).
- The API route for the page and the dialog (or reuse of the system notice
  payload), and the notice condition mechanism (a new condition kind or a custom
  predicate) for "user existed before the entry and is past first login".
- How the client store carries both version and build, and the exact handover
  comparison.
- Layout of the dialog and page, using TREK components and theme tokens.
