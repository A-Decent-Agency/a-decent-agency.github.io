# The Decent Agency Planning Office

**Good things. Under construction.** The landing page for [A Decent Agency](https://github.com/A-Decent-Agency): a cosmic construction site, a public planning office, and a free local-first map editor. Built by The Jolly LaMa / A Decent Agency for useful parts, unlikely connections, and Decent Frankensteins.

Plain HTML, CSS, and browser ES modules. No framework, bundler, build step, account, database, or application server. Apache-2.0.

## Run locally

From this repository:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000/` (not `file://`; modules and snapshot fetches need HTTP). Local asset URLs are relative, including the data fetch, so the same directory works on GitHub Pages, a subpath, or a path/subdomain IPFS gateway. Include `.nojekyll` when publishing to Pages.

Three.js **0.169.0**, OrbitControls, and ethers **6.13.4** come from the pinned jsDelivr import map in `index.html`. Ethers loads only after a wallet-connect click. Typography uses optional Google Fonts with system fallbacks. CDN connectivity is needed for 3D and wallet features; a failed 3D import/WebGL context falls back to the complete 2D list. IPFS hosting is not a promise of offline CDN availability. Nothing connects a wallet, requests accounts, signs, pays, or changes chains automatically. The isolated `js/decent-head/` adapter discovers EIP-6963 wallets (with a chooser for multiple providers) and falls back to `window.ethereum`; it can be replaced by DecentHead vNext later.

## Explore the marathon

The office uses a checked-in, privacy-filtered snapshot of [DecentAgency — Agency Marathon](https://github.com/orgs/A-Decent-Agency/projects/3), project node `PVT_kwDODD7ovc4Bn91h`. The source project is private: visitors do **not** need access or a token to view the public snapshot. GitHub source links may require access.

- **Board:** Todo / In Progress / Done / Blocked, six spatial cards per column per page. Pagination keeps dense boards usable; the 2D list always contains **all** matching items.
- **Construction flight (landing view):** an actual perspective flight corridor through the GitHub roadmap. Dated milestones are sites in Start/Target order; undated milestones and workstream yards follow in Horizon order. Each non-milestone card belongs to its workstream yard, so every matching public item appears exactly once. Workstream grouping does not invent milestone dependencies. Route spacing is navigational, not proportional to time, effort, or budget. Select any site, use previous/next, or click its 3D sign to chart an approach. Open **What is being built here?** to inspect its real cards.
- **Roadmap:** milestones positioned by Start (or Target if Start is missing), duration lines to Target, a UTC today marker, and an undated staging area. Dates are plans, not promises.
- **Workstreams / Canopy:** orbit clusters by Workstream, eight spatial cards per cluster per page. Dependency lines are solid cyan; crossovers are dashed gold. Parsing recognizes milestone identifiers (`M1`), linked item URLs, and repository-name arrows (`decent-canopy -> big-nuten`). Prose is retained in the side panel, not guessed into edges. Only endpoints on the current spatial page are connected.
- **Repo passports:** Portfolio cards colored by Role (legend below the scene), sized and raised by Baseline met count.
- **Reuse & Standards:** Shared solution / Standard / Decision shelves.
- **Project view selector:** all exported GitHub view names, layouts and filter strings are preserved in the snapshot; supported filters reproduce the current field:value / quoted value / comma-OR / negation views across the spatial tabs. The office reinterprets these as 3D views; it does not clone GitHub's private column order, hidden fields or table configuration. Future GitHub filter operators beyond this subset need an adapter update.

Search works across titles, public notes, and fields. Orbit by dragging empty space, zoom with the wheel, hover for a title, click for full fields and safe Markdown notes. Use **2D list** for keyboard-accessible cards, or **Motion off** to stop animation. Reduced-motion preferences, small screens and `saveData` default to the list, without loading WebGL. Arrow keys/Home/End switch tabs; Escape closes card details. Empty states and network errors leave the local editor usable.

### Fly between construction sites

Focus the flight canvas: **W / up arrow** thrusts, **S / down arrow** reverses,
**A / D** steers sideways, **Q / E** changes altitude, **Shift** boosts, and
**Space** pauses. Dragging steers too; it does not orbit the whole canvas. Labeled
hold controls support touch. You can maneuver 24 units either side and 16 units
above/below the curved route, but cannot leave its endpoints. Steering cancels
auto-pilot. Motion off or pause turns destination selection into an instant jump.
The original orbitable board/roadmap, complete list, and local editor remain.

Site footprint follows public card count. Crane density follows **explicit
In Progress counts**: one foundation crane at Todo-only sites; `1 + ceil(sqrt(active))`
at active sites, capped at six; zero when all cards are Done. A large but unstarted
backlog is not drawn as a busy build. Blocked sites carry restricted-access
status; Done retires cranes, but does not independently prove deployment. These
are visual planning proxies, not workforce, monetary, effort, or completion
measurements. Construction scaffolds, signs, route gates and the ship are generated
locally; no additional image lookups or private identities are inferred.

The flight scene renders on demand and at no more than 30fps while moving. It
stops when inactive/hidden or paused, clears held keys on focus loss, and respects
reduced motion. Switching back to another office tab deactivates the flight
renderer. No weapons, scores, rewards, wallet actions, or project writes are added.

### Today's flight: explainable daily route

`js/todays-flight.js` derives a small, read-only route from the privacy-filtered
snapshot selection. It uses explicit **In Progress** status for active work,
explicit **Ready for review / Review ready** status (or **Review status: Ready /
Ready for review**) for review suggestions, and explicit **Blocked** status or
open **Decision** cards for blockers/decisions. A blocked card does not, by itself,
establish which decision is needed. A PR link, body prose, Horizon or planning
date never proves review readiness, deployment, or priority.

A next-task suggestion requires **Todo** and a complete Dependencies field:
either exactly `None` / `No dependencies` (optional terminal punctuation), or
an unambiguous list of item IDs, exact titles, exact source URLs or milestone IDs
such as `M1; M2`, all explicitly **Done**. Optional `Requires:` / `Depends on:`
prefixes are accepted. Missing records, mixed prose, arrows, ambiguous aliases,
unfinished prerequisites and withheld dependencies cannot establish eligibility.
Done is a planning status, not deployment evidence. Unknown dependencies remain
unknown, including when a prerequisite is outside the current selection.

The pure `todaysFlight(items, { maxPerGroup: 3 })` export returns `groups`, bounded
`stops`, dependency-unknown/waiting counts, and excluded-duplicate-ID count. Each
stop includes a stable ID, source `item`, `itemId`, construction `destinationId`,
`why`, field `evidence`, and dependency assessment. Each group reports its total
and omitted count. The limit is clamped to 1–5 per group; stable source IDs break
ties, not inferred importance. No current date, deadline, live GitHub check,
project status change or GitHub write is invented.

Optional `js/todays-flight-ui.js` exports
`mount({ container, items, onDestination, onItem, maxPerGroup })`, returning
`{ update(items), destroy() }`. Load `css/todays-flight.css` and supply an isolated
container. `onDestination(siteId)` navigates the existing construction route;
`onItem(item)` opens the existing source-card panel. Call `update` when the
public snapshot selection changes. The panel uses plain-text DOM rendering,
keyboard-native buttons, no animation and no network or wallet actions; empty
groups explain the missing evidence.
### Docking and changes since the previous publication

The standalone `js/planning-dock.js` module is ready for the flight controller to
mount; it does not change the existing page or scene itself. Optionally load
`css/planning-dock.css` for bounded scrolling, compact disclosure rows and focus
styles. It uses no dependencies, storage, network requests or project writes.

```js
import { mountPlanningDock } from './js/planning-dock.js';
import { compareSnapshots, isPublishedSnapshot } from './js/planning-changes.js';

const dock = mountPlanningDock({
  container, site, items: current.items, previous, current, onItem: openDetail,
});
dock.update({ site: nextSite, items: nextCurrent.items, previous: nextPrevious, current: nextCurrent });
// When leaving the flight UI permanently:
dock.destroy();
```

`site` uses the existing `constructionSites()` shape: `{ id, title, type, items }`.
Membership is by stable ID, with card content always re-read from `current.items`,
not stale site objects. `items` is a fallback membership list only when `site.items`
is absent. `onItem(item)` receives the current source card. `update()` merges
provided options; pass `previous: null` to reset the comparison. `destroy()`
removes its click listener, markup and held options. Pure
`renderPlanningDock(options)` returns the same escaped HTML for testing.

`isPublishedSnapshot(snapshot)` validates schema version 1, a parseable publication
date, unique nonempty stable IDs, titles and string/string-array field values.
`compareSnapshots(previous, current)` is pure and returns `kind`:
`first-observation`, `unavailable`, or `compared`; `changed` is `null` when no
comparison is possible. Successful comparisons expose sorted `added`, `removed`,
`updated`, `newlyBlocked`, `completed` ID arrays, `statusChanges` entries
`{id, from, to}`, and `dateShifts` entries `{id, field, from, to}` for Start/Target.
`updated` includes every observably modified existing card, including status/date
changes; it is not a disjoint count. Additions already marked Done/Blocked remain
additions, not fabricated transitions. Array/field/item order and export-time-only
refreshes do not count as card changes. Source prose edits count as updates, never
as dependency satisfaction or completion evidence.

The host owns **in-memory-only** `previous`/`current` references. Start with
`previous = null`; after a distinct valid publication, rotate `previous = current`
before adopting the new current snapshot. Do not rotate on an identical poll, a
failed fetch, invalid/incomplete data, a different project URL or an older export.
Validate both the transport response and completeness before adopting a snapshot:
the structural validator cannot prove that an exporter fetched every page.
Keep the existing dock/baseline on failure; pass invalid data only to display an
explicit unavailable state. Reload clears this baseline: the first observation
is explicitly **not** “nothing changed.” No full private/public snapshots, tokens
or diff results should be persisted to browser storage.

Dock counts and callbacks refer to actual site cards, not inferred tasks.
Workstream yards disclose each card's source Outcome, notes/evidence,
Dependencies and Crossovers instead of inventing a shared finish line.
Long source notes and relation text are collapsed; remaining cards are listed
separately from Done cards. Summaries are project-wide with site-specific transition
details; removed workstream cards use previous explicit Workstream membership,
without recovering previous titles. Private/body-redacted cards expose no notes,
Outcome, relation fields or links. Explicit canonical HTTPS GitHub repository,
issue/PR and project references are linked; arbitrary queries/fragments are
removed (only the exporter draft-card selector is preserved). No repository is
guessed from a bare name or `#number`. A source card marked Done, a changed export,
and a deployment independently verified are three different things.
### Project identity signs (integration module)

`js/site-identities.js` exports pure, offline `itemIdentity(item)`,
`siteIdentity(site)` and `isSafeArtworkUrl(url)` helpers. These are integration
building blocks; importing them does not change the flight scene or load images.
The result contains `{ kind, label, projects, artwork, fallback }`; each project
also includes `repositoryUrl`, `association`, `associationEvidence`, and artwork
provenance (pinned revision, source/evidence/license URLs, credit, verification date).
`fallback` supplies a distinct monogram/color for locally drawn wayfinding,
**not an official project logo**.

Only exact public repository references and five reviewed portfolio item IDs
**with their explicit repository links still present** establish identity.
Titles, workstream names, dependency mentions and ENS names do not. Private or
body-redacted items fail closed. Unknown repositories stay unbranded. A milestone
is always an `MS` route gate; a workstream yard has no primary project logo,
even when only one member has an identified repository. `projects` describes
explicitly linked members, not ownership of the whole yard. A caller-created
`type: 'repository'` site receives primary artwork only when every member
explicitly resolves to the same public repository.

Reviewed public sources on **2026-10-23**:

| Project | Pinned project-owned asset | Identity evidence |
| --- | --- | --- |
| [Canopy](https://github.com/TheJollyLaMa/DecentCanopy) | `assets/decentcanopy-ens-favicon.png` at `14aef826` | Repository `index.html` favicon |
| [Busking](https://github.com/TheJollyLaMa/DecentBusking) | `img/hat.svg` at `7c3658a2` | Repository `index.html` favicon; platform emoji appearance varies |
| [BigNuten](https://github.com/TheJollyLaMa/BigNuten_Vanilla) | `img/BigNuten.png` at `8eb8d131` | Repository `index.html` favicon / “BigNuten Logo” |
| [Head](https://github.com/TheJollyLaMa/DecentHead) | `img/ens/head-avatar.png` at `3b2a72f7` | Public artwork commit [`9aa196ca`](https://github.com/TheJollyLaMa/DecentHead/commit/9aa196caf305588b9a677fb1b6dc7db784fdb932), Supporter-front adaptation |
| [Market](https://github.com/TheJollyLaMa/DecentMarket) | `img/ens/market-avatar.png` at `76afe749` | Repository `data/market-ens.json`; **prepared, not proof of published ENS** |

Each source README licenses artwork under **CC BY 4.0**; credit **The Jolly LaMa /
A Decent Agency**, retain the source and license links, and indicate modifications.
No images are bundled or altered here. Metadata uses full immutable commit URLs;
never substitute a GitHub owner's avatar or a third-party service logo.

Optional accessible panel: import `mountSiteIdentity` from
`js/site-identities-ui.js` and include `css/site-identities.css`. Call
`const panel = mountSiteIdentity(container, site)` (inactive, no image requests),
then `panel.update(selectedSite, { active: true })` **only for a selected/nearby
site**. It creates at most three lazy images, with source/license credit and local
badges retained on failure. `panel.update(site)` disables image rendering;
`panel.destroy()` removes the panel. Use a bounded number of mounted panels,
not one per library card. Remote images require connectivity and may fail under
CSP/offline hosting; metadata and local badges still work. No automatic ENS,
wallet, GitHub API, image fetch or global observer runs on import.

For 3D integration, draw `fallback.monogram`/`color` as immediate local sign
textures. Give milestone gates a distinct silhouette and `MS` label. Keep yard
names primary, with a small row of member project badges, never a guessed yard
owner. Load an allowlisted `project.artwork.url` only as a bounded selected/nearby
upgrade, dispose replaced textures, and retain fallback on CORS/load failure.
Expose provenance/credit in the selected-site panel; artwork is identity
wayfinding, not evidence of integration, deployment, funding or endorsement.

## Snapshot sync and privacy

Node **20+**, no dependencies beyond built-in `fetch`:

```sh
GITHUB_TOKEN="$(gh auth token)" node scripts/export-project.mjs
node --test
```

The exporter queries GraphQL directly, paginates project items, preserves the project title/README/views, maps the twelve custom fields (including the Baseline met multi-select), and writes `data/project.json`. It refuses incomplete exports if GitHub reports more than 100 views or field values. Deleted/inaccessible item contents are skipped. It retains the previous snapshot/timestamp if substantive data has not changed; `exportedAt` means the last changed snapshot, **not** the last polling attempt.

### Privacy contract

- Linked issues/PRs use the repository's **`isPrivate`**, never an inferred visibility. Private linked contents publish **only an opaque project-item ID, title, Kind, Status, Start, Target, and a privacy marker**. No body, repository, URL, Outcome, Dependencies or other fields.
- Unlinked `Portfolio: <name>` drafts for **Bean, DeCentMaker / DecentMaker, JacobsLadder26, DuoDuel, DecentCalendar, DecentCanvas, DecentFoot / DecentFooter, TheJokerWillPlay** omit their bodies. A linked repository's explicit visibility takes precedence over this fallback list.
- Other draft Markdown bodies are retained, truncated to 4,000 characters. Public issue/PR bodies are also bounded to 4,000 characters. Private portfolio fields remain visible as requested; the steward should review field values before publishing new project content.
- Raw GraphQL responses and credentials are never written to disk or logged. The browser does not authenticate to the steward's project. This is an intentional **public projection of private planning data**: review the resulting snapshot before merging, and extend the private-name list when the inventory changes. Project README and titles are public by design.

### Scheduled refresh

`.github/workflows/sync-project.yml` runs every six hours (at minute 17), or with **Run workflow**. GitHub can delay schedules. It gracefully emits a notice and skips if the credential is absent. It commits **only** `data/project.json` if changed, using `GITHUB_TOKEN`'s `contents: write` for the commit, and includes the Copilot co-author trailer.

The browser checks that published snapshot every five minutes while visible,
on return to the tab, or with **Refresh plan**. Sites, dates, crane counts and card
lists rebuild only when the snapshot changes, preserving the selected site by ID
when possible. Search and exported GitHub Project-view filters also apply to the
flight. The header separates the last changed export from the browser's check
time; its freshness tooltip explains old exports. Failed refreshes explicitly
retain the previous snapshot and never infer new progress. This is dynamic,
privacy-filtered publishing, **not** live private-project access or a guarantee
that a GitHub schedule runs on time. Both export commits and deployment run the
Node tests before publishing.

The steward must:

1. Create a **classic personal access token** with **`read:project`**, belonging to an account with read access to the private org project. Authorize it for the org's SSO if required. Access to linked private-repository contents can require additional repository permissions; the exporter still strips their details. Do not grant extra scopes unless needed.
2. Add it as the repository Actions secret **`PROJECT_READ_TOKEN`**. Never put it in a file, public variable, workflow YAML, browser, or commit. Use an expiry and rotate it.
3. GitHub Pages uses **Source: GitHub Actions**. `deploy-pages.yml` publishes on every push to `main` and after each successful project sync, so refreshed snapshots go live (bot pushes alone do not trigger Pages builds). Branch protection that disallows bot pushes may require a different, PR-based sync policy.

## Make your own map · house your own data

The editor supports title/kind/color/notes, adding/editing/deleting nodes, linking/unlinking, and dragging nodes on the 3D XY plane. It stores a single versioned map under `decent-office-map-v1` in this site's **localStorage**. The Agency board is read-only and is never changed by visitor edits. There is no application backend, telemetry, upload proxy, or agency storage service.

**We never receive your map.** The hosting provider sees ordinary page requests; CDNs see asset requests; the services you explicitly choose see those requests. Browser storage is origin-specific, may be unavailable in private mode, can be cleared, and is not a backup. Storage failures are surfaced; download JSON to keep a copy. There is no multi-tab conflict resolution, undo or collaborative editing.

Housing options in the header's **IPFS** button / editor's **House your data** panel:

1. **Download JSON:** portable `{schemaVersion: 1, nodes: [...], links: [...]}`; import validates and replaces the current map after confirmation. Unknown properties are discarded. Max 500 nodes, 2,000 links, 16 MB imported JSON, 4,000 note characters per node. Imported positions are clamped to a bounded plane.
2. **Your local IPFS Desktop / Kubo:** `POST http://127.0.0.1:5001/api/v0/add?pin=true`, multipart file, pinned on your own node. Keep the API loopback-only. Add the **exact** site origin to `API.HTTPHeaders.Access-Control-Allow-Origin`, allow POST/OPTIONS as needed, then restart Kubo; do not use `*`, expose port 5001 publicly, or disable browser security. HTTPS-to-loopback/local-network browser restrictions and local node availability may prevent this; JSON download and your own pinning tools always remain options.
3. **Your Pinata account:** the JWT is held only in the password field/in-flight request memory, sent directly to `https://api.pinata.cloud/pinning/pinFileToIPFS`, and cleared immediately on use or panel close. It is never put in browser storage. Pinata account permissions, quotas and billing are yours. No agency pinning account is used.
4. **Public CID:** validated CID loaded directly through `https://ipfs.io/ipfs/<CID>` with a bounded JSON stream and timeout. The gateway sees your request and may be unavailable/rate-limited. Opening a map prompts before replacing your current map.
5. **Your GitHub Project:** paste an org/user project URL and your own token. Requests go directly to `https://api.github.com/graphql`, using **the same exporter and privacy filter** as Node. The token is session memory only and cleared after use or panel close. The sanitized snapshot becomes editable nodes with notes/field summaries, not a live two-way GitHub sync. It never changes or publishes to the steward's project. Imported project edges are not automatically inferred in the editor; add your own links.

**IPFS publication is public and immutable.** Pinning prompts for confirmation. Review everything before publishing; never pin credentials, secrets, or private personal data. Our infrastructure does not enforce retention or delete copies held elsewhere. Wallet connection is optional and unrelated to storage or pinning permissions.

### Verification

`node --test` covers private repository redaction, all private portfolio aliases, draft truncation, multi-select fields, pagination, Markdown escaping/protocol restrictions, view filters, relationships, validation, and storage round trips.

For optional browser acceptance tests, serve the site as above and use an **already installed Playwright** (Chromium). Playwright is a development-only tool, not a site dependency:

```sh
OFFICE_URL=http://localhost:8000/ \
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
SCREENSHOT_DIR=office-shots \
node scripts/verify-browser.mjs
```

The helper exercises each real-data 3D/2D view; hover/click; filters/pagination; local CRUD, dragging, linking, import/export, reload persistence; credential clearing; EIP-6963/fallback wallets with no RPC before a click; mocked Kubo, Pinata, public gateway and GitHub integrations; reduced motion; mobile overflow; failed CDN fallback; and an IPFS-style path prefix. No real wallet signature, remote pin, private project import, or external publication is performed by the tests. A successful mock does not prove your node/account/network configuration works.

## File map

- `index.html`, `favicon.svg`, `css/office.css` — static shell and responsive Decent construction-site styling.
- `js/decent-head/head.{js,css}` — swappable header, About/IPFS entry points, wallet discovery.
- `js/main.js` — tabs, accessible list/details, local editor and housing interactions.
- `js/scene.js` — pinned Three.js scene, controls, spatial views, picking and dragging.
- `js/construction-scene.js`, `js/construction-model.js` — bounded ship flight, source-derived construction sites and crane/workload rules.
- `js/model.js` — view filters, color semantics, date and relationship parsing.
- `js/markdown.js` — HTML-escaped, small Markdown subset (no raw HTML/images).
- `js/editor.js` — versioned map validation/storage, import/export.
- `js/project.js`, `scripts/export-project.mjs` — shared GraphQL exporter/privacy boundary and Node entry point.
- `data/project.json` — the real public project snapshot.
- `.github/workflows/sync-project.yml` — six-hour/manual snapshot sync.
- `tests/*.test.js`, `scripts/verify-browser.mjs`, `scripts/verify-flight.mjs` — focused unit/acceptance checks.
- `.nojekyll`, `package.json`, `LICENSE`, `NOTICE`, `README.md` — publishing, metadata and documentation.

Run `npm test` for the dependency-free unit/privacy suite. For optional browser
acceptance, serve this checkout, set `OFFICE_URL`, `SCREENSHOT_DIR` and
`PLAYWRIGHT_MODULE` to an existing Playwright installation, then run
`node scripts/verify-flight.mjs` and `node scripts/verify-browser.mjs` **sequentially**
to avoid competing headless WebGL contexts. The flight helper checks real snapshot
coverage, steering frame bounds, pause, dynamic published-snapshot changes and
failure retention, all original tabs, reduced motion and 375/320px touch layouts.

## License and credits

[Apache License 2.0](./LICENSE). See [NOTICE](./NOTICE).

Copyright 2026 **The Jolly LaMa / A Decent Agency**. Header visual language adapted from the DecentCanopy family; this is a small independent adapter, not a vendored DecentHead release. Three.js/OrbitControls and ethers are MIT-licensed third-party libraries loaded from jsDelivr; DM Sans and Space Grotesk are SIL Open Font License fonts served by Google Fonts. Their respective licenses remain applicable. No third-party library code is vendored into this repository.
