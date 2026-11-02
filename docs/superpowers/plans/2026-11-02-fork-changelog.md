# Fork Changelog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fork images carry a build name that TREK's update notice understands, and every user gets the fork's changelog entries they missed in one dialog, plus a What's new page.

**Architecture:** The image build writes `APP_BUILD` next to `APP_VERSION`; the server reports it beside the version (socket welcome, app config) and the client compares builds when both sides have one. A JSON changelog in the repo is validated by a shared zod schema; the server's notice registry turns each entry into a system notice shown to accounts created before the entry's day, so TREK's own modal, ordering and per-user dismissals do the rest. A small page lists all entries.

**Tech Stack:** NestJS 11 + Kysely/SQLite, React + Vitest, zod in `shared/`, Docker multi-stage build.

**Spec:** `docs/superpowers/specs/2026-11-02-fork-changelog-design.md` (its "Settled after the builder check" section is binding).

## Global Constraints

- Branch `feat/fork-changelog` in the worktree `~/code/trek-changelog` (based on `v5.1.0`). Conventional commits, no AI attribution, the repo's configured author.
- Node runs only in Docker: `docker run --rm -e NODE_OPTIONS=--max-old-space-size=5000 -v ~/code/trek-changelog:/app -w /app/<workspace> node:24-alpine <cmd>`. After changing `shared/src`, `npm run build` in `shared` before server/client tests.
- `runningVersion()` and `APP_VERSION` never change meaning: plugins and the places issuer keep seeing the upstream version.
- Changelog notice ids: `fork-changelog:<entry id>`. Entries English; dialog/page chrome in English and Dutch only (`shared/src/i18n/en|nl/`).
- A user sees an entry when their account was created before the entry went live: the server records, per entry id, the time of its first start with that entry (app settings key `fork_changelog_live:<id>`, written once, never overwritten). No login condition.
- Order in the modal: the welcome tour (priority 120 on `jord`) first, then changelog entries newest first, then TREK's release notes (110). Use priority 115 for changelog notices so the existing sort (priority, severity, publishedAt desc) yields newest first.
- Every ratchet green (server: typecheck, typecheck:tests, lint:format, lint:size, lint:strict, lint:boundaries, lint:tx, lint:test-sql, lint:test-mocks, lint:test-new-service, lint:query-api, lint:service-http, lint:response-contracts; client: typecheck, lint:format, lint:size, lint:pairs, lint:dup, lint:layers, lint:offline, lint:rtl, lint:skips, lint:strict, theme:lint, lint:i18n-keys; shared: typecheck, lint, format:check, specs). Full eslint may run out of memory: then compare per-rule warning counts of touched files against the task's base commit.
- Tests use made-up data only.

## Review Focus

1. A server without a build name (upstream image, dev) behaves exactly as today: version comparison, no build shown. Test in Task 1.
2. A malformed changelog file fails a test at build time, never at runtime for users. Test in Task 2.
3. A user created before the entry's live-since time gets it, one created after does not, regardless of login count; a second server start does not move the live-since time. Test in Task 2.
4. Dismissing one changelog notice leaves later entries showing; dismissing all shown entries stops the dialog. Test in Task 2.
5. The What's new page with zero entries shows an empty state, not a blank page. Test in Task 3.

---

### Task 1: Build identity

**Files:**
- Modify: `Dockerfile` (ARG `APP_BUILD=` in the client stage and the runtime stage; write `/app/server/BUILD` when set, beside `VERSION`), `client/vite.config.js` (define `__TREK_UI_BUILD__` from `APP_BUILD`), `server/src/app-config/image-version.ts` (add `imageBuild()` reading `BUILD`), `server/src/app-config/running-version.ts` (add `runningBuild(): string | null`), `server/src/nest/realtime/realtime.gateway.ts` (welcome gains `build`), the app-config response the client reads at launch (find where `version` is sent; add `build`), `client/src/store/serverVersionStore.ts`, `client/src/utils/versionHandover.ts`, `client/src/api/websocket.ts`, `client/src/components/Settings/AboutTab.tsx` (+ where it gets `appVersion`)
- Test: beside each changed unit (existing test files for these modules)

**Interfaces:**
- Produces: `runningBuild(): string | null`; welcome `{ type: 'welcome', socketId, version, build: string | null }`; app config `build: string | null`; client store fields `reportedBuild`/`firstBuild` (or one `identity` = build ?? version — implementer's choice, tested); `offersNewBuild(version, build?)` compares builds when the bundle and the server both have one.
- [ ] **Step 1: Failing tests**: `runningBuild()` returns the BUILD file's content and null without it; welcome carries `build`; the store notes a build change as new even when the version is equal; with no build on either side the old version behaviour holds (Review Focus 1); About shows the build when present, else `v<version>`.
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.** The Dockerfile writes `BUILD` only when `APP_BUILD` is set; never touch how `VERSION` is written.
- [ ] **Step 4: Tests + ratchets** — PASS. Build the image once locally is not required (CI builds it).
- [ ] **Step 5: Commit** — `feat: report a build name beside the version`

### Task 2: Changelog data and notices

**Files:**
- Create: `shared/src/fork-changelog/fork-changelog.schema.ts` (+ spec, + barrel export), the data file (location is the implementer's call; it must ship in the image and be readable by the server; e.g. `server/assets/fork-changelog.json` copied by the Dockerfile's existing `server/assets` line), `server/src/systemNotices/fork-changelog.ts` (load, validate, map entries to `SystemNotice`)
- Modify: `server/src/systemNotices/registry.ts` (append the generated notices), `server/src/systemNotices/types.ts` + `conditions.ts` (new condition `{ kind: 'accountCreatedBeforeLive'; entryId: string }`, `ctx.user.created_at`, and the live-since times resolved up front like `settingFlags`), `server/src/nest/system-notices/system-notices.service.ts` (pass `created_at`), a read endpoint `GET /api/fork-changelog` (authenticated; returns the validated entries newest first), `shared/src/i18n/en|nl/system_notice.ts` (dialog title "New in TREK: {title}", CTA "See all changes"), the first real entry
- Test: shared schema spec; `server/tests/unit/systemNotices/fork-changelog.test.ts`; registry/service tests; an integration test for the endpoint

**Interfaces:**
- Produces: `forkChangelogEntrySchema` `{ id, date: 'YYYY-MM-DD', title, items: { kind: 'added' | 'changed' | 'fixed', text }[] }` and `forkChangelogSchema` (array, unique ids); notices with `id: 'fork-changelog:<id>'`, `display: 'modal'`, `priority: 115`, `publishedAt: <date>T00:00:00Z`, `conditions: [{ kind: 'accountCreatedBeforeLive', entryId: id }]`, body built from the items as a Markdown list via `bodyParams`, CTA `{ kind: 'nav', href: '/whats-new' }`; `GET /api/fork-changelog` → `{ entries: ForkChangelogEntry[] }`.
- First entry (Jord's real changes): id `2026-11-02-fork-start`, date `2026-11-02`, title "Place names, a welcome tour and smarter list imports", items: added "A Show place names switch on the Atlas, on desktop and phone."; added "New friends get a short video tour of TREK on their first login."; added "Importing a Google Maps list now shows a preview: pick the countries you want, and places already in your trip are recognised, even with a slightly different name."
- [ ] **Step 1: Failing tests**: schema accepts the real file and rejects a duplicate id, a bad date and an unknown kind (Review Focus 2, a test that loads the shipped file); live-since is recorded on first start and kept on the next; an account created before it gets the entry and one created after does not, whatever `login_count` (Review Focus 3); two entries come back newest first and after the welcome tour's priority; dismissing one leaves the other (Review Focus 4); `dismiss('fork-changelog:<id>')` is accepted; the endpoint returns entries newest first to a logged-in user and 401 without a session.
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Tests + ratchets** — PASS.
- [ ] **Step 5: Commit** — `feat: show the fork's changelog to users who missed it`

### Task 3: What's new page

**Files:**
- Create: `client/src/pages/WhatsNewPage.tsx` (+ test), a client API call for `GET /api/fork-changelog`
- Modify: `client/src/App.tsx` (route `/whats-new`, behind the same auth wrapper as `/settings`), `client/src/components/Settings/AboutTab.tsx` (a "What's new" link), `client/scripts/feature-pairs.json` (mark the page per the manifest's rules: shared for both shells or phone-only/desktop-only with a reason), `shared/src/i18n/en|nl` (page title, empty state, item kind labels)
- [ ] **Step 1: Failing tests**: the page lists entries newest first with date, title and items labelled by kind; zero entries shows the empty state (Review Focus 5); a failed load shows TREK's usual error state; the About link navigates to `/whats-new`.
- [ ] **Step 2: Run them to see them fail.**
- [ ] **Step 3: Implement** with TREK page components and theme tokens; readable in both shells (the phone renders the same route if that is how `/settings` works; follow it).
- [ ] **Step 4: Full client suite once (`npx vitest run --maxWorkers=4`) + all ratchets in the three workspaces** — PASS.
- [ ] **Step 5: Commit** — `feat: a What's new page for the fork's changelog`

Not in this plan (controller, at merge into `jord`): pass `APP_BUILD=${version}-jord.${run}` in `.github/workflows/jord-image.yml`, note the changelog in FORK.md, and from then on add an entry to the changelog file with every user-visible change.
