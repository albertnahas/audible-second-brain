# Contributing

Thanks for considering a contribution. This plugin lives at the intersection of personal taste, heuristics, and tooling — so most contributions fall into one of these buckets:

## Bucket 1 — Calibration heuristics

The `calibrate` skill is where the real intelligence lives. If you have ideas for better signals (e.g., narrator-affinity, time-of-purchase patterns, series-completion behavior), open an issue describing the heuristic and the data you'd derive it from. Code changes go in `skills/calibrate/SKILL.md` (the spec) and may also touch `templates/_score.starter.py` if a new constant needs ferrying.

## Bucket 2 — Dashboard / UX

The dashboard template (`templates/dashboard/`) is a single static HTML + JS bundle, served by `python3 -m http.server`. No build step. Keep it that way — adding a bundler / framework defeats the "scaffolds easily into any user's directory" property.

## Bucket 3 — Skill descriptions

Auto-invocation depends on `description` in the SKILL.md frontmatter. If you find that Claude isn't picking the right skill for a phrasing, open a PR adding the trigger phrase to the relevant skill's description. Be specific — vague descriptions hurt all skills in the plugin.

## Bucket 4 — Other Audible regions / marketplaces

The plugin has been tested against US + EU Audible accounts via `audible-cli`. If you use a marketplace that breaks (e.g., specific region quirks), please open an issue with the symptom + your `audible --version` output.

## Development workflow

1. Fork and clone.
2. Install the plugin locally for testing:
   ```bash
   /plugin install <local-path-to-clone>
   ```
3. Make changes.
4. Validate manifest + skills with the `plugin-dev:plugin-validator` agent (if available) or by running through the user flow manually in a fresh directory.
5. PR with a clear description and a CHANGELOG entry under `[Unreleased]`.

## Code style

- Python: PEP 8, type hints where they clarify intent, no over-defensive code.
- Bash: `set -euo pipefail` at the top, prefer Python for non-trivial logic.
- Markdown: 2-space indent in lists, no trailing whitespace.
- SKILL.md descriptions: action verb + when-to-use trigger phrases. Front-load intent.

## Releasing

Maintainer-only:

1. Update `version` in `.claude-plugin/plugin.json`.
2. Move `[Unreleased]` entries into a new dated section in `CHANGELOG.md`.
3. Tag the commit (`git tag v0.X.Y && git push --tags`).
4. Cut a GitHub release pointing to the new tag.
