# All Inclusive Tracker

A web app that replaces the `All Inclusive.xlsx` rate-tracking spreadsheet and
extends it with price history, weighted scoring, filtering, and per-resort pages.

## Running it

```bash
npm run dev
```

Then open http://localhost:3210.

## What came from the spreadsheet

The importer (`scripts/seed.mjs`) translates all 14 rows faithfully:

| Spreadsheet | App |
| --- | --- |
| `Cheapest Room` / `Price 1` | a room with tier `entry` and a price snapshot |
| `Best Room for Us` / `Price 2` | a room with tier `target` and a price snapshot |
| `Sale!` | `salePrice` on the target room's snapshot |
| `Room Service` = `24-hour` | amenity met, plus a `24-hour room service` tag |
| `Oceanview` = `Best Room` | amenity set on the target room only, not the entry room |
| `Criteria` (column M) | replaced by the weighted match score |
| `Column 13` (column N) | replaced by `effectivePrice()` — sale price when present |
| `Sale!` = `CLOSED` | resort `status: closed` |

The `Best Room` convention was the sheet's cleverest idea and is now first-class:
amenities live on the **room**, so "you only get the tub if you upgrade" is a
fact about the room, and the rankings table shows `●` (entry room has it) vs.
`◐` (upgrade required).

Re-running `npm run seed` **overwrites** `data/db.json`. Don't run it after you
start entering real prices.

## What the spreadsheet couldn't do

- **Price history.** Prices are append-only snapshots, never overwritten, so
  every resort gets a trend line, a "lowest ever seen" figure, and a change-
  since-last-capture column.
- **Multiple date ranges.** Every price belongs to a trip (dates + occupancy),
  so the same resorts can be shopped for several weeks independently.
- **Multiple sources.** Each snapshot records where it came from — resort
  direct, CheapCaribbean, All Inclusive Outlet, Costco, Expedia. When several
  sources have a price for the same room on the same day, the cheapest one is
  the one that counts.
- **Weighted criteria.** The sheet's rollup formula was all-or-nothing: one
  `No` and the resort read `No`. Now each criterion carries a weight, and one
  marked *required* disqualifies a room outright.
- **Filtering, sorting, comparison.** Filter by destination, transfer time,
  price ceiling and must-have amenities; sort by price, match score, biggest
  drop, or dollars per match point; tick resorts to compare side by side.

## The update workflow

`/capture` is the page that replaces the periodic spreadsheet edit: one row per
room, one submit for the whole round. Blank fields are skipped, so partial
rounds are fine. Every resort row links straight out to its booking site and to
CheapCaribbean / All Inclusive Outlet searches for cross-checking.

Add a **booking URL template** on a resort's page and the dates get injected
automatically. Supported placeholders:

```
{checkIn} {checkOut} {checkInUS} {checkOutUS} {checkInCompact} {adults} {children} {nights}
```

For example:

```
https://www.example-resort.com/booking?arrive={checkIn}&depart={checkOut}&adults={adults}
```

## Layout

```
app/            pages (rankings, capture, compare, resort detail, trips, criteria)
components/     Rankings table, PriceChart, Sparkline, TripSwitcher
lib/types.ts    domain model
lib/db.ts       JSON store — the only file that knows about persistence
lib/scoring.ts  pricing rollup and weighted match scoring
lib/view.ts     builds the serializable view model pages hand to the client
lib/actions.ts  every write (Next server actions)
scripts/seed.mjs  spreadsheet importer
data/db.json    your data
```

## The published site

`main` is published to GitHub Pages by `.github/workflows/deploy.yml` on every
push. Build it locally with:

```bash
npm run build:static
```

The output lands in `out/`. It is the same app in **read-only mode**: static
export cannot run server actions, so capture, editing and delete controls are
omitted (see `lib/mode.ts`). Trip switching and side-by-side comparison still
work — selection is resolved in the browser from the URL rather than on a
server.

For a custom domain served from the root, set a repository variable
`PAGES_BASE_PATH` to an empty string, or build with
`npm run build:static -- --base ""`.

## Tuning criteria on the published site

Scoring is not baked in at build time. `lib/rank.ts` is a pure function of the
data plus a criteria configuration, and it runs on both sides: the server uses
it to render the pages, and the browser re-runs it when a viewer reorders or
switches off criteria on the live site.

So `/criteria` on the published site is interactive. Reordering changes the
weights, switching one off drops it from scoring, the columns and the filters,
and everything recomputes with no server involved. That weighting is kept in
the viewer's own browser and never reaches the repo — the local app stays the
source of truth for the published default. "Copy as link" encodes a weighting
into the URL, which takes precedence over the browser's copy so a shared link
always shows the sender's view.

## Automated refresh

`.claude/skills/refresh-rates/SKILL.md` defines a Claude job that reads current
rates, records them, and pushes — which republishes the site. Its two CLI ends
are usable by hand too:

```bash
npm run queue
```

prints the worklist — every resort, its booking URL with the trip's dates
injected, and the rooms to price. `npm run queue -- --stale 7` limits it to
resorts not priced in the last week.

```bash
npm run record -- --resort "TRS Turquesa" --room target --price 2545 --sale 2160
```

appends one observation. It validates the resort, room and price and reports
the change against the previous one; `--dry-run` checks a call first.

The job only records what it can actually read. Resorts without a
`bookingUrlTemplate`, and sites that block automated access, are reported and
skipped rather than guessed at.

## How reliable the automation is

Each resort runs its own booking engine and several actively discourage
automated access, so the refresh job is best-effort by design: it records what
it can read and reports what it couldn't, rather than guessing. Expect partial
runs, and expect individual resorts to need their `bookingUrlTemplate` fixed
when a site is redesigned. The manual `/capture` page remains the fallback and
is always faster than debugging a broken selector.

Because every snapshot is source-tagged, an affiliate feed (Travelpayouts,
Expedia TAAP, Hotelbeds) can later write `PriceSnapshot` rows with a new
`source` and everything else works unchanged.

`data/db.json` is a plain file — back it up by copying it.
