# Ideas backlog

Design ideas registered for the future. Nothing here is committed to be
built as described — each entry is a starting point to be refined when
its time comes.

## Prestige system (cost-reduction reset)

**Problem:** generator costs scale with a triangular exponent (1, 10, 1K,
1M, 10B…), so each next generator takes exponentially longer to unlock.
Even buying boosts (fragment ×2 production upgrades) and stacking units of
existing generators, waiting eventually becomes impractical — the wall is
structural, not a tuning issue.

**Idea:** a prestige mechanic where the player sacrifices all current
progress (base resource, generators, possibly fragments) in exchange for a
**permanent halving of generator costs** (or something along those lines).
Prestige is **repeatable indefinitely** — not a one-time event: the player
can keep resetting forever, and each prestige makes the whole curve
cheaper, letting every run reach further generators than the previous
one — the classic endless incremental prestige loop.

**Open questions for when this gets designed:**

- What exactly resets? (base, generators, boosts… do fragments survive?)
- Effect shape: flat ÷2 on all generator costs per prestige, or a scaling
  factor based on progress at the moment of sacrifice?
- Does the discount stack multiplicatively across prestiges (÷2, ÷4, ÷8…)?
- When does prestiging become available/worth it? (e.g. gate it behind
  reaching a specific generator)
- How does it interact with the unlock ETA predictor and the Activity log?

**Status:** idea only — do not implement yet.
