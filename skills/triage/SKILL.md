---
name: triage
description: Guide the user through interactive PASS/LATER/KEEP review of library and wishlist items. Use when the user says "triage my wishlist", "clean up my library", "decide what to keep", "what should I cut", "let's go through my list". Surfaces highest-leverage decisions first (long unfinished commitments, low-score wishlist items) and persists decisions to dashboard localStorage and an audit log.
---

# Triage — interactive review

The user has too many books. This skill walks them through high-impact decisions in priority order, persists each decision, and respects existing keyboard shortcuts in the dashboard.

## When this fires

- User explicitly invokes triage.
- After a sync that surfaces ≥ 5 newly-PASS items.
- After calibration when the rubric flagged previously-KEEP items as now-PASS.

## Inputs

- `library.scored.json` and `wishlist.scored.json` (must be fresh — run `sync` first if `.audible-snapshot.json` is stale).

## Triage queues (in priority order)

1. **Stalled long commitments** — `library` items where `listeningStatus == "In progress"` AND `remaining_min ≥ 600` (10h+ left). Highest leverage to drop.
2. **Library PASS** — `library` items with `category == "PASS"` AND `listeningStatus == "Not started"`. Hidden cost: clutters the dashboard.
3. **Wishlist CUT** — `wishlist` items with `category == "CUT"`. Easiest to remove.
4. **Wishlist MAYBE** — `wishlist` items with `category == "MAYBE"`. Most ambiguous; review last.
5. **Library LATER** — items predicted as low-priority but not bad enough to PASS.

## Interaction model

For each item, present a compact card:

```
№ 023 / 087 — The Singularity Is Nearer  +1
by Ray Kurzweil · 13h 21m · cluster: ai_socio · category: LATER
Score reasons: -2 long without high-affinity cluster, +1 length 13.4h ok
Status: Not started · 0% complete

[K]eep · [L]ater · [P]ass · [S]kip · [Q]uit
```

Accept the user's response (single-letter or word) and persist immediately. Don't batch — partial work must be durable.

## Persistence

Decisions are written to **two** places:

1. **`triage-decisions.jsonl`** (in the user's working directory) — one JSON object per line:
   ```json
   {"asin":"B08X4QZ4KH","decision":"PASS","at":"2026-04-27T14:32:01Z","source":"triage","previous":null}
   ```
   Append-only, never rewritten. Audit trail.

2. **Dashboard localStorage key** `books-decisions-v1` — only if the dashboard is currently open in a tab. Otherwise, the dashboard reads `triage-decisions.jsonl` on next load and reconciles.

## Reconciliation rules

- The most recent decision per ASIN wins (`triage-decisions.jsonl` is the source of truth).
- The dashboard's localStorage gets overwritten on dashboard load if it disagrees with the JSONL.
- A user can "reset all decisions" — that writes a `{"action": "reset", "at": "..."}` line to JSONL and clears localStorage.

## Anti-patterns

- Do not mass-decide ("PASS all 30") without explicit user confirmation per batch of 10.
- Do not surface items from the same author back-to-back — interleave to reduce decision fatigue.
- Do not compute new scores during triage — that's what `sync` and `calibrate` are for. Triage is purely about applying the user's verdict to already-scored items.
- Do not delete items from `library.json` / `wishlist.json` — those are canonical exports from Audible. Decisions are a separate layer.

## Closing summary

End the session with:

```
Triage session 2026-04-27 14:48
Reviewed: 18 items
Decisions: 8 PASS · 6 LATER · 4 KEEP
Estimated time saved: ~94h of listening you can reclaim
Next suggestion: open the dashboard (./serve.sh) to see the rotation update.
```
