---
name: bootstrap
description: First-time setup of an Audible second-brain workspace. Use when the user wants to "set up audible-second-brain", "install audible cli", "bootstrap my book library", "start tracking my Audible books", or is in a fresh directory and asks Claude to begin organizing their Audible library. Walks through audible-cli installation, OTP login, the first library + wishlist export, and scaffolds preferences.md / _score.py / dashboard from generic starter templates.
---

# Bootstrap — first-run setup

This skill takes a user from zero to a working Audible second-brain in their current directory.

## Outcome

After running, the user has:

- `audible-cli` installed and authenticated against their Audible account
- `library.json`, `library.csv`, `wishlist.json`, `wishlist.csv` exported
- `preferences.md` — a **generic starter rubric** with placeholder authors/clusters
- `_score.py` — a starter scorer that reads the audible-cli schema
- `scripts/regenerate-md.py` — markdown-from-JSON generator
- `dashboard.html` + `dashboard.js` — interactive triage dashboard
- `serve.sh` — re-runs the scorer and starts the dashboard at `http://localhost:8888`
- `library.scored.json`, `wishlist.scored.json` — scored copies
- `CLAUDE.md` — local instructions Claude reads on subsequent sessions
- `.aissist-snapshot` (optional) — a marker so other skills know setup is complete

The user is told upfront: **the rubric is generic**. To personalize it, they run the `calibrate` skill once they have ~20 finished books (or now, if they already have completion data).

## Inputs

- Working directory: must be empty or already scaffolded; refuse if it contains a non-trivial codebase that would conflict.
- User's confirmation that they own an Audible account.

## Steps

1. **Pre-flight**
   - Confirm the working directory: `pwd`. If it looks like an existing project (has `package.json`, `Cargo.toml`, etc.), ask the user to confirm.
   - Check Python: `python3 --version` (need ≥ 3.9).
   - Check pip / pipx availability.

2. **Install `audible-cli`**
   - Prefer `pipx install audible-cli` (cleaner isolation). Fallback: `pip install --user audible-cli`.
   - Verify with `audible --version`.

3. **Authenticate (interactive — user must drive this)**
   - Tell the user: "I'll guide you through Audible OTP login. You'll need to be ready to receive a one-time code on your phone."
   - Run: `audible manage auth-file add --external-login`
   - Walk them through marketplace selection (US / UK / DE / FR / etc. — match their account).
   - On failure, link them to the audible-cli docs: https://github.com/mkb79/audible-cli#authentication

4. **First export**
   - From the working directory:
     ```bash
     audible library export -f json
     audible library export -f csv
     audible wishlist export -f json
     audible wishlist export -f csv
     ```
   - Note: do NOT pass `-o` to `audible wishlist export` in v0.3.3 (str-vs-Path bug).

5. **Scaffold from templates**
   - Copy `${CLAUDE_PLUGIN_ROOT}/templates/preferences.starter.md` → `./preferences.md`
   - Copy `${CLAUDE_PLUGIN_ROOT}/templates/_score.starter.py` → `./_score.py`
   - Copy `${CLAUDE_PLUGIN_ROOT}/templates/_classify.starter.py` → `./_classify.py`
   - Copy `${CLAUDE_PLUGIN_ROOT}/templates/scripts/regenerate-md.py` → `./scripts/regenerate-md.py` (mkdir scripts first)
   - Copy `${CLAUDE_PLUGIN_ROOT}/templates/dashboard/dashboard.html` → `./dashboard.html`
   - Copy `${CLAUDE_PLUGIN_ROOT}/templates/dashboard/dashboard.js` → `./dashboard.js`
   - Copy `${CLAUDE_PLUGIN_ROOT}/templates/serve.sh` → `./serve.sh` and `chmod +x`
   - Copy `${CLAUDE_PLUGIN_ROOT}/templates/CLAUDE.template.md` → `./CLAUDE.md`
   - Copy `${CLAUDE_PLUGIN_ROOT}/templates/.gitignore.template` → `./.gitignore`

6. **First classification + scoring + dashboard**
   - Run: `python3 _classify.py` to LLM-classify every book into a topic cluster (writes `classifications.json`). Cost ~$0.03 for a 300-book library, ~5 min runtime via the headless `claude` CLI. Skippable if the user prefers regex-only routing — tell them they can run `/audible-second-brain:classify` later.
   - Run: `python3 _score.py` to produce `library.scored.json` + `wishlist.scored.json` (uses LLM clusters if available, falls back to regex).
   - Run: `python3 scripts/regenerate-md.py` to produce `library.md` + `wishlist.md`.
   - Tell the user: "Open the dashboard with `./serve.sh`."

7. **Persist a freshness marker**
   - Write `.audible-snapshot.json`: `{ "last_sync": "<ISO timestamp>", "books_owned": <count>, "books_finished": <count>, "calibrated": false }`. Other skills use this.

8. **Closing nudge**
   - Tell the user: "Your scorer is using a **generic starter rubric**. Once you have ~20 finished books in your library, run `/audible-second-brain:calibrate` to derive a personalized rubric from your own completion patterns. Until then, expect the scoring to be directionally useful but not fully aligned with your taste."

## Failure modes

- **audible-cli OTP fails**: pause and ask the user to retry. Do not loop more than 3 times — direct them to https://github.com/mkb79/audible-cli/issues.
- **Marketplace mismatch** (e.g., user picked US but their account is FR): library export returns 0 rows. Detect this and prompt them to re-run `audible manage auth-file remove` then re-add with the correct marketplace.
- **Existing files**: if any scaffolded path already exists, never overwrite without confirmation. Show a diff if the user wants.

## Anti-patterns

- Do not attempt to automate the OTP — Audible requires the user to paste the code.
- Do not write user credentials anywhere outside `~/.audible/` (audible-cli's default).
- Do not preset HIGH_TRUST authors based on the user's library on day 1 — that's `calibrate`'s job.
