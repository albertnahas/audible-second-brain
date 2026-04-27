# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-04-27

### Added

- Initial five-skill plugin: `bootstrap`, `sync`, `recommend`, `calibrate`, `triage`.
- SessionStart hook (`scripts/check-freshness.py`) that surfaces stale-snapshot and uncalibrated-rubric reminders.
- Headless CLI wrapper (`bin/audible-sync-cli`) for cron / CI use.
- Generic starter scorer (`templates/_score.starter.py`) and rubric (`templates/preferences.starter.md`).
- Editorial dark-themed dashboard template (`templates/dashboard/`).
- Markdown regeneration script (`templates/scripts/regenerate-md.py`).
- Documentation: README, architecture overview, design decisions.

[Unreleased]: https://github.com/albertnahas/audible-second-brain/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/albertnahas/audible-second-brain/releases/tag/v0.1.0
