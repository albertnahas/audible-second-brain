---
name: recommend
description: Propose new audiobook candidates aligned with the user's preferences.md rubric. Use when the user says "what should I read next", "find me books like X", "recommend audiobooks", "suggest something on topic Y", "fill my wishlist with quality candidates". Returns scored candidates with rationale, ready to add to the wishlist.
---

# Recommend — propose new candidates

This skill turns the user's `preferences.md` rubric into outward-facing recommendations: surface books they don't yet own, scored against their rubric, with explicit reasoning the user can accept or reject.

## Inputs

- `preferences.md` — user's current rubric (HIGH_TRUST authors, CLUSTER_RULES, ANTI_PATTERNS, length preferences).
- `library.scored.json` and `wishlist.scored.json` — what the user already owns / wants.
- Optional: a topic constraint from the user ("more books on negotiation", "anything from authors in the same school as my favorites").

## Steps

1. **Read the rubric**
   - Parse `preferences.md` for HIGH_TRUST, SCHOOL_AUTHORS, anti-patterns, and current cluster weights.
   - Read `_score.py` if `preferences.md` is silent on a value (the code is authoritative for thresholds).

2. **Generate candidates**
   - Three sources, in order of trust:
     a. **Adjacent works by HIGH_TRUST authors** — every other audiobook by a HIGH_TRUST author the user does not already own. Use Claude's general knowledge; do not invent titles.
     b. **Co-citation expansion** — books cited by or commonly co-shelved with the user's finished titles, filtered to those whose cluster matches the user's high-affinity clusters.
     c. **Topic constraint** — if the user gave one, expand within that topic, weighted by cluster preference.

3. **Score each candidate against the rubric**
   - Use the same scoring logic as `_score.py` (mirror the heuristics in your head — author trust, cluster match, anti-patterns, length).
   - Reject anything matching ANTI_PATTERNS without explanation cost.
   - Filter out anything already in `library.scored.json` or `wishlist.scored.json` (by title + author).

4. **Output**
   - Markdown table with columns: Title · Author · Predicted score · Rationale (one line) · Length estimate.
   - Group by score band: KEEP (≥ 4), MAYBE (1–3), CUT (≤ 0).
   - Limit: 12 candidates default; user can ask for more.

5. **Optional: write to disk**
   - If the user accepts, write `recommendations.json` in the same shape as `wishlist.json` so `_score.py` can re-score it (it already supports a `recommendations.json` file).
   - User can then triage these in the dashboard alongside their actual wishlist.

## Anti-patterns

- Do not hallucinate titles. If unsure a book exists, say so or skip it.
- Do not recommend titles that match the user's `ANTI_PATTERNS` (formats / publishers they've previously bought without finishing) unless there's a strong cluster justification — and even then, flag the conflict explicitly so the user can decide.
- Do not exceed 5 recommendations from any single author — the goal is breadth, not deep dive (deep dives are explicit user requests, not recommendations).

## Variants

- "Recommend something short I can finish this weekend" → filter to 3–5h runtime, score-bonus the candidates that are normally borderline.
- "Anything new from <a HIGH_TRUST author>?" → bypass scoring, just enumerate; use the rubric only as a tiebreaker.
- "Replace my whole wishlist with better candidates" → score the current wishlist as a baseline, then propose 75 candidates that beat it.
