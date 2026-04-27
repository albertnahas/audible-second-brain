# Design decisions

A log of the decisions that shaped this plugin, with the reasoning. Future maintainers can challenge or revisit these.

## DD-001 — Bootstrap and calibrate are separate skills

**Context**: A naive design would derive the user's rubric during bootstrap.

**Decision**: Bootstrap ships a *generic* rubric. Calibrate is a separate, explicit skill that runs once the user has enough completion signal.

**Why**: On day 1 the user has no completion data — any rubric derived at install time would either be the same generic starter (pointless) or a hallucinated set of "trusted authors" (worse than nothing). Splitting lets bootstrap stay fast and deterministic, and makes personalization a deliberate, repeatable act.

**Tradeoff**: Two-step UX. Mitigation: the SessionStart hook surfaces a calibration nudge once the user crosses the threshold.

## DD-002 — Skills do not invoke each other

**Context**: It's tempting to have `bootstrap` automatically run `sync` after install, or have `sync` auto-run `triage` if it finds new PASS items.

**Decision**: Each skill ends with a conversational nudge. Claude decides what to invoke next based on context.

**Why**: Claude Code does not currently support skill→skill chaining via the Skill tool. Even if it did, hard-wiring would couple the skills in ways that surprise users. Conversational nudges keep the user in control.

## DD-003 — Generic-but-real cluster rules

**Context**: The starter rubric needs to do *something* useful before calibration runs. Empty cluster rules would mean scoring is purely length-based until calibration.

**Decision**: Ship a non-trivial set of CLUSTER_RULES regexes covering 9 broad clusters (software_craft, trauma, habits, power, ai_socio, cognition, evolution, spirituality, investing) with Audible category strings included.

**Why**: These clusters cover ~90% of non-fiction Audible content. Even without calibration, books get routed to a real category, and the dashboard's "library by cluster" chart is meaningful from day 1.

**Limitation**: Fiction-heavy users will find every book in `other`. Future work: ship a starter cluster set focused on fiction sub-genres as a configurable bootstrap variant.

## DD-004 — JSON snapshot file as plugin's freshness signal

**Context**: How does the SessionStart hook know whether to nudge the user?

**Decision**: A small `.audible-snapshot.json` file in the workspace, written by `bootstrap` and updated by `sync` and `calibrate`.

**Why**: A workspace-local file means the hook works without any global state. Users can have multiple workspaces (e.g., personal + family-shared) and each tracks its own freshness independently.

## DD-005 — Static HTML dashboard, no build step

See `architecture.md` § "Why a static-HTML dashboard".

## DD-006 — `triage-decisions.jsonl` as audit log alongside `localStorage`

**Context**: The original dashboard stored decisions in `localStorage` only. That's lost if the user clears browser data, switches browsers, or wants to track decisions in git.

**Decision**: Triage writes to both an append-only `triage-decisions.jsonl` (canonical) and `localStorage` (cache). On dashboard load, the JSONL wins.

**Why**: Append-only audit logs are diffable, reviewable, and survive client-side state loss. JSONL means a single decision is a single line — easy to grep, easy to replay.

## DD-007 — `audible-cli` as the only Audible touchpoint

**Context**: Could have built our own Audible scraping (Playwright-based, like the original).

**Decision**: Defer entirely to `audible-cli` for auth + export.

**Why**: Maintaining a scraper against Audible's UI is a treadmill. `audible-cli` is mature, community-maintained, and uses Audible's actual API. The plugin focuses on what it does uniquely: scoring + triage + calibration.

**Tradeoff**: Some fields that the scraper could surface (publisher_summary, hasReview, hasPDF, availability) are not in the audible-cli export. We've chosen to live without them rather than maintain two ingestion paths.

## DD-008 — Plugin namespace is verbose by design

**Context**: Skill commands are namespaced as `/audible-second-brain:bootstrap`, which is a lot to type.

**Decision**: Keep the verbose name rather than shortening to `/audible:*`.

**Why**: "audible" alone is too generic and risks colliding with other plugins or trademark concerns. Users tend to invoke skills by intent ("sync my library") rather than by command anyway, so the verbosity rarely surfaces.
