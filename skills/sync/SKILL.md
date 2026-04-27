---
name: sync
description: Refresh Audible library and wishlist exports, regenerate scored JSON, and update the dashboard. Use when the user says "sync my library", "refresh books", "update audible data", "I bought a new book", "I finished a book", "regenerate dashboard", or after a SessionStart hook reports the snapshot is stale (>14 days old).
---

# Sync — refresh exports + scored data

This skill is the canonical refresh path. Run it after the user finishes a book, returns a credit, buys something new, or just to keep the dashboard current.

## Pre-conditions

- Working directory contains `_score.py`, `scripts/regenerate-md.py`, `dashboard.html`, `dashboard.js` (i.e., bootstrap was run).
- `~/.audible/` has a valid auth file. If not, route the user to `bootstrap` (re-run auth section only).

## Steps

1. **Re-export from Audible**
   ```bash
   audible library export -f json
   audible library export -f csv
   audible wishlist export -f json
   audible wishlist export -f csv
   ```
   Run from the working directory; all four commands write to `./` by default. Do **not** pass `-o` to `audible wishlist export` in v0.3.3.

2. **Regenerate scored data**
   ```bash
   python3 _score.py
   ```
   Outputs `library.scored.json` and `wishlist.scored.json` (with `score`, `reasons`, `cluster`, `category` per record).

3. **Regenerate human-readable markdown**
   ```bash
   python3 scripts/regenerate-md.py
   ```
   Outputs `library.md` (grouped by listening status) and `wishlist.md` (sorted by date added).

4. **Compute and report the delta**
   - Compare `library.scored.json` against the prior `.audible-snapshot.json`.
   - Report to the user:
     - New titles added (appeared since last sync)
     - Newly finished titles (`is_finished` flipped to true)
     - Titles whose `percent_complete` jumped > 10%
     - Wishlist additions / removals

5. **Update the freshness marker**
   - Overwrite `.audible-snapshot.json`: `{ "last_sync": "<ISO timestamp>", "books_owned": <count>, "books_finished": <count>, "calibrated": <preserve previous value> }`.

6. **Surface what changed in plain language**
   - Example: "Synced 219 → 221 titles. You finished *Atomic Habits* (was 67% → done). Two new wishlist additions: *Tidy First?* by Kent Beck, *Outlive* by Peter Attia."
   - If the user has now crossed the 20-finished threshold for the first time, suggest running `/audible-second-brain:calibrate`.

## Optional flags / variants

- "Just re-score, don't re-export" → skip step 1 (useful when the user manually edited `_score.py` or `preferences.md`).
- "Just re-export, don't re-score" → skip steps 2–3 (rare; useful for diagnostics).

## Failure modes

- **Auth expired**: audible-cli prints `401 Unauthorized`. Walk the user through `audible manage auth-file remove` + `audible manage auth-file add --external-login`.
- **`audible wishlist export -o` error**: known v0.3.3 bug — drop the `-o` flag.
- **Score script crashes**: usually a schema drift. Read `_score.py`'s `normalize()` function and check that field names still match the audible-cli output.
