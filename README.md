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

## Notes on automation

There is no reliable way to auto-fetch these rates: the resorts each run their
own booking engine, and the OTAs actively block scraping. So the site optimizes
the manual loop instead — pre-filled deep links out, bulk entry back in — and
keeps the data layer source-agnostic. If you later get access to an affiliate
feed (Travelpayouts, Expedia TAAP, Hotelbeds), it can write `PriceSnapshot`
rows with a new `source` value and everything else works unchanged.

`data/db.json` is a plain file — back it up by copying it.
