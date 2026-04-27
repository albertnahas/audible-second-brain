---
name: calibrate
description: Re-derive the user's personal scoring rubric (HIGH_TRUST authors, ANTI_PATTERNS, CLUSTER_RULES, length preferences) from observed completion data. Use when the user says "calibrate my rubric", "personalize the scorer", "learn my taste", "update my preferences from data", or after enough new completion signal accumulates (≥ 20 finished books since last calibration, or first time after bootstrap).
---

# Calibrate — derive a personal rubric from completion data

The starter `preferences.md` shipped by `bootstrap` is generic. This skill replaces the placeholders with **evidence-based** values derived from the user's own `library.json`. Run it after the user has enough finished + abandoned signal — typically ≥ 20 finished books.

## Why this is its own skill

- Bootstrap is fast and deterministic; everyone gets the same starter.
- Personalization needs evidence (completion ratios, abandon points, topic-fit patterns) which only exists once the user has been listening for a while.
- Calibrating prematurely on thin data overfits — better to wait and run this explicitly.

## Pre-conditions

- `library.json` exists and contains ≥ 20 records with `is_finished: true`. If less, tell the user the rubric will be undertrained and ask them to confirm before proceeding (or wait).
- `preferences.md` exists (bootstrap was run, or a previous calibration).

## Inputs

- `library.json` — owned books with `is_finished`, `percent_complete`, `runtime_length_min`, `genres`, `authors`.

## Derivation rules

### HIGH_TRUST authors
- An author with **≥ 2 finished books** AND **completion ratio ≥ 0.6** (finished ÷ owned).
- Output: a sorted set written into `preferences.md` and `_score.py`'s `HIGH_TRUST = { ... }`.

### SCHOOL_AUTHORS (warm but not yet HIGH_TRUST)
- Authors with **≥ 1 finished book** AND **owned in ≥ 2 of the user's top-3 clusters** (by finished count).
- Bucketed under cluster headings in `preferences.md` for human review before merging into the canonical set.

### UNTOUCHED_MAGNUM
- Authors with **≥ 1 owned book of length ≥ 12h** AND **0 finished** AND **percent_complete < 5**.
- These get score penalty `-2 reason: "<author> long unread"`.

### ANTI_PATTERNS
- Detect formats / publishers where the user has bought ≥ 3 titles AND finished none. Common shapes to look for:
  - Branded "guide" series from a single institutional publisher
  - Genre patterns the user owns repeatedly but never opens (e.g., parody, humor, fiction-shaped non-fiction)
  - Hands-on / implementation books when the user's reading pattern leans conceptual (or vice versa)
- Each becomes a regex anti-pattern with the rationale appended (e.g., `# N owned, 0 started`).

### Length preferences
- Compute completion ratio per length band: <3h, 3–5h, 5–9h, 9–14h, 14h+.
- The "abandon cliff" is the band where ratio drops sharply. Use it to set the score penalty boundary in `_score.py`.

### Cluster weights
- Count finished titles per cluster. Top-3 clusters get `+2`, next 2 get `+1`, rest `0`.
- Don't change the regex patterns — those are stable. Only adjust the score values per cluster.

## Steps

1. **Load library.json** and count finished/owned per author.
2. **Compute the four sets** above (HIGH_TRUST, SCHOOL, UNTOUCHED_MAGNUM, ANTI_PATTERNS).
3. **Compute the length-band completion ratios** and identify the abandon cliff.
4. **Compute the cluster weights** from finished titles.
5. **Diff against current `preferences.md` + `_score.py`** — show the user a concise summary of what would change. Example shape (placeholders, not real values):
   ```
   HIGH_TRUST adds: <Author A>, <Author B>, <Author C>
   HIGH_TRUST removes: <Author D> (now 1 of 3 finished — borderline)
   ANTI_PATTERN added: <publisher / format pattern> (N owned, 0 finished)
   Cluster weight changes: <cluster X> +2 → +1 (you've cooled on it)
   Abandon cliff: 14h → 12h (you abandon earlier than the default rubric assumes)
   ```
6. **Ask for confirmation**, then write the new values to `preferences.md` AND patch `_score.py`'s constants.
7. **Re-run `_score.py`** so library/wishlist scoring reflects the updated rubric.
8. **Update the snapshot marker**: set `calibrated: true`, `calibrated_at: <ISO>`, `finished_at_calibration: <count>`.

## Anti-patterns

- Don't blindly overwrite the user's manually-curated entries (look for `# kept manually` comments or similar). Diff-then-confirm is the contract.
- Don't include authors with only 1 finished book in HIGH_TRUST — too noisy.
- Don't reduce cluster weights to 0 — even a "cooling" cluster still has signal value above completely-untracked clusters.

## Reporting

Output a short summary the user can save (numbers / names below are illustrative):

> Calibrated `<date>`. Library: `<N>` owned, `<M>` finished (`<X>`%). Top clusters: `<cluster1>` (`<a>`), `<cluster2>` (`<b>`), `<cluster3>` (`<c>`). HIGH_TRUST: `<K>` authors. ANTI_PATTERNS: `<P>` detected. Abandon cliff at `<H>`h. Run `/audible-second-brain:sync` to apply scoring.
