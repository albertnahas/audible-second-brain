# Architecture

## Two-tier separation

The plugin separates **scaffolding** (what gets dropped into the user's workspace) from **orchestration** (the skills that drive the workflow).

```
┌────────────────────────────────────────────────────────────────────┐
│                        Plugin repo                                 │
│  ┌──────────────────────┐    ┌─────────────────────────────────┐   │
│  │  Skills (prompts)    │    │  Templates (scaffolded into     │   │
│  │  — auto-invoked       │───▶│  user's workspace by bootstrap) │   │
│  │  by Claude            │    │  — _score.py, preferences.md,  │   │
│  └──────────────────────┘    │    dashboard.{html,js}, etc.    │   │
│         │                    └─────────────────────────────────┘   │
│         │ writes / reads                                           │
│         ▼                                                          │
│  ┌──────────────────────┐                                          │
│  │  User workspace      │                                          │
│  │  ./library.json      │                                          │
│  │  ./preferences.md    │                                          │
│  │  ./_score.py         │                                          │
│  │  ./dashboard.html    │                                          │
│  │  ./.audible-snapshot │                                          │
│  └──────────────────────┘                                          │
└────────────────────────────────────────────────────────────────────┘
```

This means:
- The user's data + customized scorer live in their workspace under their own version control.
- The plugin can be updated without churning the user's data.
- Power users can hand-edit `_score.py` and `preferences.md` without losing it on plugin update.

## Skill boundaries

| Skill | Reads | Writes | When |
|---|---|---|---|
| `bootstrap` | none (fresh dir) | scaffolds everything | once per workspace |
| `sync` | `library.json`, `wishlist.json` (via audible-cli) | `library.scored.json`, `wishlist.scored.json`, `library.md`, `wishlist.md`, `.audible-snapshot.json` | regularly |
| `recommend` | `preferences.md`, scored JSONs | optional `recommendations.json` | on demand |
| `calibrate` | `library.json` | `preferences.md`, `_score.py` (constants only) | once user has ≥ 20 finished books |
| `triage` | scored JSONs | `triage-decisions.jsonl`, dashboard `localStorage` | as desired |

## Why no inter-skill chaining

Claude Code skills cannot invoke each other via the Skill tool. Instead, each skill ends with a conversational nudge ("now consider running `/audible-second-brain:sync`") and Claude routes the next step naturally based on context.

The SessionStart hook fills the same gap for asynchronous reminders: it returns `additionalContext` (not a command) when the snapshot is stale or calibration is overdue, and Claude decides whether to act.

## Data ownership

- **Audible auth**: lives in `~/.audible/`, managed by `audible-cli`. The plugin never reads or transmits this.
- **Library / wishlist data**: plain JSON / CSV in the user's workspace. The user owns the directory; the plugin only writes derivative files (`*.scored.json`, `*.md`).
- **Decisions / preferences**: `preferences.md` is the canonical taste store; `triage-decisions.jsonl` is the canonical decision audit log. Both are user-readable plain text.

## Extension points

Three obvious places to extend:

1. **New cluster** — add a regex tuple to `CLUSTER_RULES` in `_score.py` (after bootstrap copies it into the user's workspace, the user can edit freely).
2. **New scoring signal** — add a `+N reasons` block to `score_item()` and document it in the user's `preferences.md`.
3. **New skill** — drop a `skills/<new-skill>/SKILL.md` in the plugin and update `README.md`.

## Why a static-HTML dashboard

The dashboard intentionally has no build step, no framework, no npm dependencies. It's a single HTML + JS file that reads the JSON from disk. Reasoning:

- The plugin scaffolds the dashboard into arbitrary user workspaces. A build step would force the user to install Node + a bundler before they could see their data.
- Charts.js via CDN handles the visualization weight without local dependencies.
- The dashboard is read-only over JSON; complexity belongs in the scorer, not the renderer.
