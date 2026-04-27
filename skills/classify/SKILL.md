---
name: classify
description: Classify books into topic clusters using Claude Haiku via the headless CLI. Use when the user says "classify my library", "fix the clusters", "categorize my books", "re-classify everything", or after `bootstrap` / `sync` notices new uncached books. Writes a per-ASIN cache (`classifications.json`) so repeated runs are cheap and idempotent.
---

# Classify — assign topic clusters via Claude Haiku

The starter rubric ships a regex-based fallback for cluster routing, but regex over title + Audible genres is too noisy: umbrella tags like "Management & Leadership" sit on systems-thinking, leadership, and strategy books indistinguishably. This skill delegates the call to a small LLM that can read the actual title + subtitle + author + genres together and pick the best cluster.

## Outcome

After running, the workspace has:

- `classifications.json` — `{ "<asin>": "<cluster_slug>", ... }` for every book in `library.json` and `wishlist.json` (or every uncached one, if `--force` was not passed).
- `_score.py` will pick up the LLM cluster for every book on its next run; the legacy regex routing is bypassed when a classification exists.

## Cluster taxonomy

The starter taxonomy (defined in `_classify.py`) covers common non-fiction territory:

- `software_engineering` — programming, architecture, infrastructure, dev culture
- `ai_society` — AI as a societal force; alignment, policy, AI critique
- `cognition` — decision-making, biases, behavioral economics, mental models
- `psychology_health` — trauma, somatic work, mental health, therapy
- `habits_productivity` — habits, focus, routines, behavior change
- `leadership_influence` — influence, persuasion, negotiation, organizational power
- `economics_finance` — personal finance, investing, markets, macro
- `philosophy_spirituality` — meditation, consciousness, religion, ethics
- `history_civilization` — big-picture human history, anthropology, sociology
- `science_evolution` — genes, biology, neuroscience, natural sciences
- `other` — fiction, language learning, parody, anything that doesn't fit

The user may want to customize this for their reading. The cluster definitions live in `_classify.py`'s `CLUSTERS` dict — straightforward to edit. After editing, run with `--force` to re-classify everything.

## Pre-conditions

- Workspace was set up via `bootstrap` (i.e., contains `_classify.py`, `library.json`, `wishlist.json`).
- `claude` CLI is available on PATH and authenticated. Test with `claude --version`.

## Steps

1. **Smoke-test the CLI**: `claude -p "Reply with the word OK and nothing else." --model claude-haiku-4-5`. If this fails, walk the user through `claude` setup before proceeding.

2. **Classify** uncached books:
   ```bash
   python3 _classify.py
   ```
   Or to re-classify everything (e.g., after editing the cluster taxonomy):
   ```bash
   python3 _classify.py --force
   ```

3. **Apply** classifications by re-scoring:
   ```bash
   python3 _score.py
   ```
   The scorer prefers the classification cache; it falls back to regex only for books not in the cache.

4. **Report** the new distribution. Print the cluster histogram and call out any books that landed in `other` (may indicate the taxonomy is missing a cluster the user cares about).

## Idempotency + cost

- The cache is keyed by ASIN. Running `_classify.py` after a `sync` only classifies newly-added books.
- Each batch is 20 books → ~1500 input tokens + ~100 output tokens. Haiku is cheap; classifying a 300-book library costs roughly $0.03.
- Batches are persisted incrementally (after each batch). Interrupt + resume is safe.

## Anti-patterns

- Don't run with `--force` casually — it spends API tokens on books whose classification hasn't changed. Reserve `--force` for taxonomy edits or recovering from a corrupted cache.
- Don't edit `classifications.json` by hand for individual books — instead, add an entry to `EXPLICIT_PASS` / `PROMOTE_LIBRARY` / `PROMOTE_WISHLIST` in `preferences.md`, which the scorer respects regardless of cluster.
- Don't add a cluster without thinking about overlap. New clusters need a clear "this book goes here, not there" criterion, otherwise Haiku will route inconsistently.

## Variants

- "Why is X classified as Y?" — read the book's record from `library.json` and walk through the title/subtitle/genres the classifier saw. If wrong, the user can correct via `EXPLICIT_PASS` / `PROMOTE_*` overrides, or refine the cluster definitions in `_classify.py` and re-run with `--force`.
- "Add a new cluster for fiction subgenres." — open `_classify.py`, add to the `CLUSTERS` dict, run with `--force`.
