# Audible Second Brain — workspace

This directory is your Audible library second brain. Files in here are managed by the [`audible-second-brain` Claude Code plugin](https://github.com/albertnahas/audible-second-brain).

## Files

- **`library.{json,csv,md}`** — All owned titles. JSON/CSV are canonical exports from `audible-cli`; MD is regenerated from JSON, grouped by listening status.
- **`wishlist.{json,csv,md}`** — Wishlist candidates, same shape as library minus listening / purchase fields.
- **`preferences.md`** — Evidence-based taste profile. Edit by hand or run `/audible-second-brain:calibrate` to regenerate from your completion data.
- **`_score.py`** — Heuristic scorer. Reads the audible-cli schema, normalizes legacy fields for dashboard compatibility.
- **`_classify.py`** — LLM cluster router (uses Claude Haiku via the headless CLI). Writes `classifications.json` keyed by ASIN.
- **`classifications.json`** — Per-ASIN cluster cache. Idempotent — only new/uncached books get classified on subsequent runs.
- **`scripts/regenerate-md.py`** — Reads `library.json`/`wishlist.json`, writes `library.md`/`wishlist.md`.
- **`library.scored.json` / `wishlist.scored.json`** — Scored copies with `score`, `reasons`, `cluster`, `category` per record.
- **`dashboard.html` / `dashboard.js`** — Interactive dashboard. Open with `./serve.sh`.
- **`.audible-snapshot.json`** — Plugin-managed freshness marker. Don't edit by hand.

## Common workflows

| You want to… | Run / say |
|---|---|
| Refresh exports + rescore | `/audible-second-brain:sync` |
| Re-classify clusters | `/audible-second-brain:classify` |
| Personalize the rubric | `/audible-second-brain:calibrate` |
| Find new books to add | `/audible-second-brain:recommend` |
| Triage your library / wishlist | `/audible-second-brain:triage` |
| Open the dashboard | `./serve.sh` |

## Direct CLI (no Claude needed)

```bash
audible library export -f json
audible library export -f csv
audible wishlist export -f json
audible wishlist export -f csv
python3 _classify.py    # LLM-classify any new books
python3 _score.py
python3 scripts/regenerate-md.py
```

For headless / cron use, the plugin ships `bin/audible-sync-cli` which does all of the above.
