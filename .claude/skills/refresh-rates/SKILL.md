---
name: refresh-rates
description: Check current all-inclusive resort rates and record them in the tracker. Use when asked to refresh rates, update resort prices, check for price drops, or run the scheduled rate refresh for the All Inclusive tracker.
---

# Refresh resort rates

Reads current prices for the resorts in `C:\development\ai-meta-site`, records
them as new snapshots, and pushes — which republishes the public site.

Prices are **appended, never overwritten**. A run that records nothing is a
normal outcome, not a failure.

## Ground rules

- **Never invent, estimate, or carry forward a price.** If a page doesn't show
  a clear total for the trip dates, skip that room and say so in the summary.
  A missing observation is fine; a wrong one corrupts the history and the
  price-drop alerts built on it.
- Record the **total stay price** for the trip's dates and occupancy, matching
  what the existing rows measure. If a site shows per-night, multiply by the
  night count and note it. If a site shows a different occupancy, skip it.
- **Look, don't act.** Never book, never enter personal or payment details,
  never create an account, never complete a CAPTCHA. Decline non-essential
  cookies.
- If a site blocks automated access, **skip it and report it**. Don't work
  around bot detection.
- Some resorts have no booking URL yet. Report them; don't guess at one.

## Steps

**1. Sync**

```bash
cd /c/development/ai-meta-site && git pull --rebase
```

**2. Get the worklist**

```bash
npm run queue -- --json
```

Each item gives the resort, the booking URL with the trip's dates already
injected, the rooms to price, and the last price seen for each. Add
`-- --stale 7` to limit the run to resorts not priced in the last week.

**3. Price each resort**

For each item, open `bookingUrl` with the browser tools and find the total for
the trip dates. Look for both rooms in the item's `rooms` list — match on the
room name, not on position in the page. Note the list price and, separately,
any discounted/sale price.

If `bookingUrl` is null, try `websiteUrl`, then `searchUrl` (CheapCaribbean).
Record the source you actually used.

**4. Record what you found**

One call per room, per source:

```bash
npm run record -- --resort "TRS Turquesa" --room target --price 2545 --sale 2160 --source resort-direct --url "https://..."
```

`--room` takes `entry`, `target`, or part of a room name. `--source` is one of
`resort-direct`, `cheapcaribbean`, `allinclusiveoutlet`, `costco`, `expedia`,
`other`. The script prints the change against the previous observation. Add
`--dry-run` to check a call first.

The script refuses a sale price higher than the list price and rejects unknown
resorts and rooms — if it errors, re-read the page rather than forcing a value.

**5. Publish**

Only if at least one price was recorded:

```bash
git add data/db.json && git commit -m "Refresh rates: <n> prices, <n> drops" && git push
```

The push triggers `.github/workflows/deploy.yml`, which rebuilds and publishes
the site. Nothing else needs to run.

**6. Summarize**

Report, briefly:

- how many prices were recorded, out of how many attempted
- every drop, with the resort, room, old price and new price
- anything skipped, and why (no URL, blocked, no price shown for those dates)

Lead with drops — that's the reason the job exists. If nothing moved, say so in
one line.
