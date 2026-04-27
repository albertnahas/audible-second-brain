# Preferences — your personal Audible rubric

> **Status: starter (uncalibrated).** This file ships as a generic template. Run `/audible-second-brain:calibrate` once you have ~20 finished books to derive a personalized rubric from your own completion patterns. Until then, the scorer will route on length + cluster + anti-patterns alone, which is directionally useful but not specific to your taste.

---

## 1. HIGH_TRUST authors

Authors you have **finished ≥ 2 books from** with a completion ratio ≥ 0.6. New books from these authors get `+3` automatically.

_(empty — `calibrate` populates this)_

## 2. SCHOOL_AUTHORS

Authors adjacent to your HIGH_TRUST set — same cluster, similar style, but only one finished book so far. New books from them get `+2`.

_(empty — `calibrate` populates this)_

## 3. Anti-patterns

Format / publisher patterns where you have a track record of buying-but-not-finishing. New books matching these regex patterns get `-2`.

_(empty — `calibrate` populates this)_

## 4. Length preferences

Default rubric (overridden by `calibrate` once it sees your abandon cliff):

| Length | Score | Notes |
|---|---|---|
| 1–3h | +1 | very short, easy to finish |
| 3–8h | +2 | sweet spot for most readers |
| 8–12h | +1 | OK for high-affinity clusters (software_craft, trauma, habits, power) |
| 12–15h | -1 | long without strong cluster signal |
| 15h+ | -1 | likely-to-abandon (-2 if reference-shaped: multi-author, "Guide" / "Principles" in title) |

## 5. Cluster weights

Default cluster routing (regex in `_score.py` `CLUSTER_RULES`). `calibrate` rebalances these `+2 / +1 / 0` values based on which clusters you actually finish.

| Cluster | Default weight | Description |
|---|---|---|
| software_craft | +2 | Engineering, coding, architecture, devops |
| trauma | +2 | Somatic / nervous-system / mental-health work |
| habits | +2 | Productivity, focus, behavior change |
| power | +2 | Influence, persuasion, negotiation, strategy |
| ai_socio | +1 | AI as a societal / philosophical force |
| cognition | +1 | Decision-making, biases, behavioral economics |
| evolution | 0 | Genes, anthropology, deep human history |
| spirituality | 0 | Meditation, consciousness, presence |
| investing | 0 | Personal finance, markets, money |

## 6. Category thresholds

Library items:
- `score ≤ -3` → **PASS** (cut from rotation)
- `score 0–2` → **LATER** (revisit when you have time)
- `score ≥ 3` → **KEEP** (active rotation)
- In-progress with ≥ 10h remaining → **LATER** unless score ≥ 1

Wishlist items:
- `score ≤ -1` → **CUT**
- `score 0–3` → **MAYBE**
- `score ≥ 4` → **KEEP**

## 7. Manual overrides

Add titles here for hard outcomes that the heuristics can't capture:

- **EXPLICIT_PASS**: titles you never want resurfaced regardless of score (e.g. classics you've decided are not for you).
- **PROMOTE_LIBRARY**: library titles you want surfaced as KEEP regardless of score.
- **PROMOTE_WISHLIST**: wishlist titles you want surfaced as KEEP regardless of score.

These map directly to the constants of the same name in `_score.py`.

---

_Last calibrated: never. Run `/audible-second-brain:calibrate` to update._
