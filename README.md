# Audible Second Brain

A Claude Code plugin that turns your Audible library into a working second brain: an evidence-based scorer, an interactive triage dashboard, and a heuristic rubric that calibrates to *your own* completion patterns over time.

This is **promptware** — most of the value is in the prompts (skills) and the heuristic rubric. The plugin scaffolds a tiny Python scorer and a vanilla-JS dashboard into your workspace, then orchestrates everything via natural language inside Claude Code.

## What it does

| Skill | What it does | When you'd use it |
|---|---|---|
| `bootstrap` | Installs `audible-cli`, walks OTP login, scaffolds scorer + dashboard from generic templates | First time, or in a fresh workspace |
| `sync` | Re-exports library + wishlist, regenerates scored data, surfaces deltas | After buying / finishing books, or weekly |
| `recommend` | Proposes new candidates aligned with your rubric | "What should I read next?" |
| `calibrate` | Re-derives HIGH_TRUST authors, anti-patterns, length cliffs, cluster weights from your own completion data | Once you have ≥ 20 finished books, or after a year of new data |
| `triage` | Walks you through PASS / LATER / KEEP decisions, persists to dashboard + audit log | "Help me clean up my list" |

A SessionStart hook surfaces a one-line freshness reminder when your snapshot is > 14 days old or when you've crossed the calibration threshold.

## Install

```bash
# In Claude Code:
/plugin marketplace add albertnahas/audible-second-brain
/plugin install audible-second-brain@albertnahas/audible-second-brain
```

Then in a fresh directory:

```
> /audible-second-brain:bootstrap
```

The skill takes it from there.

## How the rubric works

Every owned and wished book is scored on four axes:

1. **Author trust** — books from authors you reliably finish get a positive score; authors whose long-form works you've never opened get a negative score.
2. **Cluster fit** — books are routed to a topic cluster (engineering, behavior change, decision-making, etc.) by matching title, author, subtitle, and Audible genre tags. Each cluster has a weight reflecting how well that topic lands for you.
3. **Length fit** — your personal "abandon cliff" (the runtime above which completion rates collapse) sets a soft penalty on long books unless they're in a high-affinity cluster.
4. **Anti-patterns** — formats or publishers where you have a track record of buying-but-not-finishing get a penalty (e.g., publisher series you've collected but never opened).

Each book then gets a category:

- Library items → **PASS** / **LATER** / **KEEP**
- Wishlist items → **CUT** / **MAYBE** / **KEEP**

The starter rubric ships with generic clusters that cover common non-fiction territory and empty author/anti-pattern lists. The **`calibrate`** skill replaces those defaults with values derived from your own data:

- Trusted authors → those with ≥ 2 finished books and a completion ratio ≥ 0.6
- Anti-patterns → formats or publishers where you own ≥ 3 books and finished 0
- Cluster weights → re-balanced so the topics you actually finish get bonus, the ones you don't get neutral
- Length cliff → derived from your per-runtime-band completion ratios

This means the scorer becomes more accurate over time without you having to think about it.

## Repository layout

```
audible-second-brain/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── bootstrap/SKILL.md
│   ├── sync/SKILL.md
│   ├── recommend/SKILL.md
│   ├── calibrate/SKILL.md
│   └── triage/SKILL.md
├── hooks/
│   └── hooks.json
├── scripts/
│   ├── check-freshness.sh
│   └── check-freshness.py
├── bin/
│   └── audible-sync-cli       # cron-friendly headless sync
├── templates/
│   ├── _score.starter.py
│   ├── preferences.starter.md
│   ├── CLAUDE.template.md
│   ├── .gitignore.template
│   ├── serve.sh
│   ├── dashboard/
│   │   ├── dashboard.html
│   │   └── dashboard.js
│   └── scripts/
│       └── regenerate-md.py
├── docs/
│   ├── architecture.md
│   └── design-decisions.md
├── README.md · LICENSE · CHANGELOG.md · CONTRIBUTING.md · .gitignore
```

## Privacy

- Audible auth is stored only in `~/.audible/` (managed by `audible-cli`, never read by this plugin).
- Library + wishlist data stays in your workspace as plain JSON / CSV / MD.
- The plugin makes no outbound network calls beyond what `audible-cli` does to refresh exports.

## Requirements

- Python 3.9+
- [`audible-cli`](https://github.com/mkb79/audible-cli) ≥ 0.3 (the bootstrap skill installs it via `pipx`)
- Claude Code 2.x or newer

## Headless / cron usage

```bash
# Refresh once a week, Monday 9am
0 9 * * 1 /path/to/your/workspace && /path/to/plugin/bin/audible-sync-cli
```

The CLI wrapper handles re-export, re-score, regenerate-md, and snapshot bookkeeping without needing a Claude session.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Issues and PRs welcome — especially calibration heuristics and dashboard refinements.

## License

MIT — see [`LICENSE`](LICENSE).
