# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] — 2026-04-27

### Added

- New **`classify`** skill: LLM cluster routing via Claude Haiku through the headless `claude` CLI. Reads each book's `{title, subtitle, authors, genres}` and assigns one of 11 cluster slugs. Caches results by ASIN in `classifications.json` — repeated syncs only classify newly-added books.
- `_classify.starter.py` template ships with a default 11-cluster taxonomy covering common non-fiction territory. Customizable by editing the `CLUSTERS` dict and re-running with `--force`.
- `bin/audible-sync-cli` and the `sync` skill now invoke the classifier between export and scoring; safe no-op when nothing new.
- Dashboard overview surfaces hours-based metrics: `Hours listened`, `Library hours`, `Backlog`, plus a wishlist sub-line showing total listening commitment if every wishlist item were bought.
- New "Hours by cluster — listened vs remaining" stacked horizontal bar chart, sorted by total commitment.
- KPI strip split into a primary headline row (six big tiles) and a secondary operational row (six smaller tiles) for visual hierarchy.
- Library + wishlist tables now show filtered totals in the count line: `X of Y shown · Zh total · Wh remaining`.

### Changed

- **Cluster taxonomy renamed** for clarity: `software_craft` → `software_engineering`, `ai_socio` → `ai_society`, `trauma` → `psychology_health`, `habits` → `habits_productivity`, `power` → `leadership_influence`, `investing` → `economics_finance`, `spirituality` → `philosophy_spirituality`, `evolution` → `science_evolution`. New `history_civilization` cluster added (was conflated with `evolution` previously).
- `_score.py`'s cluster routing is now a two-tier system: prefer the LLM classification from `classifications.json`, fall back to a tightened regex for books not yet classified. Regex rules are now intentionally narrow — earlier broad keyword matches like `\bstrategy\b`, `\bpower\b`, and umbrella genre tags caused systemic miscategorization.

### Fixed

- Hours math now uses `percent_complete` directly instead of treating `is_finished: true` as 100% of runtime. The `is_finished` flag is unreliable for hours calculations — many books carry `is_finished: true` with `percent_complete = 0` (listened pre-tracking) or `99` (end credits skipped). Aligns the dashboard's "Hours listened" with Audible's reported listening time within ~5%.
- Backlog excludes finished books regardless of `percent_complete`. A finished book is "off the hook" even if Audible's playback position never reached 100%.
- Headless `audible-sync-cli` no longer corrupts the snapshot's `calibrated` flag (Python comparison was always evaluating to `False`).

## [0.1.0] — 2026-04-27

### Added

- Initial five-skill plugin: `bootstrap`, `sync`, `recommend`, `calibrate`, `triage`.
- SessionStart hook (`scripts/check-freshness.py`) that surfaces stale-snapshot and uncalibrated-rubric reminders.
- Headless CLI wrapper (`bin/audible-sync-cli`) for cron / CI use.
- Generic starter scorer (`templates/_score.starter.py`) and rubric (`templates/preferences.starter.md`).
- Editorial dark-themed dashboard template (`templates/dashboard/`).
- Markdown regeneration script (`templates/scripts/regenerate-md.py`).
- Documentation: README, architecture overview, design decisions.

[Unreleased]: https://github.com/albertnahas/audible-second-brain/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/albertnahas/audible-second-brain/releases/tag/v0.2.0
[0.1.0]: https://github.com/albertnahas/audible-second-brain/releases/tag/v0.1.0
