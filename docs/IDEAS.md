# Ideas backlog

Design ideas registered for the future. Nothing here is committed to be
built as described — each entry is a starting point to be refined when
its time comes.

## Prestige system (production multiplier)

**Problem:** generator costs scale with a triangular exponent (1, 10, 1K,
1M, 10B…), so each next generator takes exponentially longer to unlock.
Even buying boosts (fragment ×2 production upgrades) and stacking units of
existing generators, waiting eventually becomes impractical — the wall is
structural, not a tuning issue.

**Implemented design:**

- Gate scales with how many times you have prestiged:
  `minGen = 3 × (prestigeCount + 1)` → 1st at G3, 2nd at G6, 3rd at G9…
- Reward per prestige: `floor(highestUnlocked / 3)` permanent levels
  (G3–G5 → +1, G6–G8 → +2, G9–G11 → +3…).
- Effect: global production × `2^prestigeLevels` (not cost reduction —
  avoids many generators collapsing to the same price).
- Resets: base, generators, fragments, uptime/steps; keeps prestige
  levels/count and play mode; returns to the mode-select screen.
- Repeatable indefinitely; you cannot re-prestige at the previous minimum.

**Still open / later:**

- Recalibrate the first gate / step size after playtesting.
- Prestige entries in the Activity log.
- Whether prestige should also affect fragment/boost costs.

**Status:** implemented in v0.20.0 (first gate G3 for testing).
