# Number Test

An idle-game mechanics laboratory: giant-number formatting with
[break_eternity.js](https://github.com/Patashu/break_eternity.js), chained
production, data-driven balancing and deterministic sync across devices.

English is the project's canonical language (docs, code, commit messages).
The UI ships in English and Brazilian Portuguese — see **Internationalization**
below.

## The tabs

- **Counter** — the original formatting playground: a number growing at 0.1/s,
  a double-production button (with auto-repeat on hold) and the K/M/B/T...`No`
  suffix ladder, followed by endless letter suffixes (`aa`...`zz`, `aaa`...)
  with odometer-style truncation.
- **Generators** — a continuous production chain: generator N produces 0.1/s
  of level N−1 per unit, down to the base number, which buys new generators
  (cost `10^(i + 0.004·i²)`, doubling per purchase). Progressive unlocks, an
  automatic mode for balance testing and a cost progress bar.
- **Cycles** — the same chain, but in bursts: generator N delivers its whole
  batch when a `5s × N` cycle completes (same average rate as Generators; the
  progression gap between the two mechanics is a studied characteristic — see
  `scripts/compare-engines.mjs`).
- **Activity** — the unlock log for both modes, with a summary header (total,
  play time, average interval) and every timing explained, pace color-coded
  (slower in red, faster in green).
- **Notes** — the patch notes page: the project's version history.
- **Settings** — tabbed configuration: save slots (create/load/rename/delete,
  per-mode resets), color themes, button-click volume (Web Audio synthesized
  press/release pair), telemetry toggles and UI language.

## Simulation architecture

- **Deterministic fixed timestep**: games advance in 0.25s steps anchored to
  the save's start timestamp. State is a pure function of the step count — two
  machines with saves started together stay bit-for-bit identical, whether the
  tab is open, hidden or closed.
- **Wall-clock catch-up**: closing/reloading loses no time; the game simulates
  the pending steps on return (offline progress included).
- **Visual extrapolation**: the logic runs at 4 steps/s, but the display moves
  every frame by interpolating with current production.
- **List virtualization**: cards outside the scroll window (and on hidden
  tabs) become same-height ghosts — lists with hundreds of generators keep the
  frame rate at the monitor's cap.

## Save slots

Classic game-style save management: each slot holds all three modes, stored
under its own `localStorage` keys. Creating, renaming, loading and deleting
slots never touches the simulation engine — slots only decide **which** keys
are read/written, so deterministic sync stays intact.

## Internationalization

A lightweight typed i18n module (`src/lib/i18n.ts`): per-locale dictionaries
with compile-time-checked keys, a `useSyncExternalStore`-based hook so the
whole app re-renders instantly on language change, and locale-aware dates.
Available languages: English, Português (Brasil) and Español — auto-detected
from the OS/browser language on first visit. The choice is persisted per
device; patch notes stay in the language they were written in.

## Telemetry and utilities

- Pills for FPS, frame time (avg/max), environment (localhost/production),
  battery (when present) and app version, with a **new version pending**
  notice via a `version.json` published on every build.
- Per-tab CSV export (raw + formatted values) for balance analysis.
- Saves in `localStorage` (origin-isolated), autosaved once per second and on
  page close. Wake lock keeps the screen awake during play.

## Running

```bash
npm install
npm run dev
```

Study scripts (Node): `node scripts/simulate-balance.mjs` (cost-curve tuning)
and `node scripts/compare-engines.mjs` (continuous vs. bursts).

## Stack

- Vite 5 + React 18 + TypeScript
- break_eternity.js for the numbers
- CSS Modules + global tokens (`src/styles/`)
- No backend: fully static

## Deploy (Vercel)

Vercel auto-detects the project as Vite (build `npm run build`, output
`dist`). Every push to `main` deploys — the build timestamp injected via
`define` feeds the version pill and the pending-update detection.
