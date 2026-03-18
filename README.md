# Paint Mix Matcher

Paint Mix Matcher is a **local-only, deterministic painter’s assistant** for planning mixtures with the nine paints you actually have on hand.

This branch is the app’s **Spectral.js engine refactor**. The predicted swatches are no longer based on weighted RGB or linear-RGB averaging. They now come from a **Spectral.js-style Kubelka-Munk pigment mixing core**, wrapped behind an internal adapter so the rest of the app stays maintainable.

## What changed in this branch

The app now optimizes for:

1. **Believable pigment-style mixture prediction**.
2. **Painter-usable recipe suggestions**.
3. **Coherent target analysis, ranking, and guidance**.
4. **Maintainable architecture with a dedicated spectral adapter layer**.

This is still **not a scientific guarantee**. The seed paints are **approximations**, not lab-measured spectral scans of your exact tubes. The goal is a **physically informed painter’s assistant**, not a claims-heavy color science product.

## Product boundaries

The app intentionally remains:

- local-only
- deterministic
- browser-based
- backend-free
- auth-free
- cloud-sync-free
- external-API-free for core functionality

All inventory, settings, recent targets, and saved recipes stay in **`localStorage` only**.

## Default on-hand palette

The default seed palette remains limited to the actual on-hand set:

- Mars Black
- Cadmium Yellow Medium
- Burnt Umber
- Ultramarine Blue
- Phthalo Blue
- Cadmium Red
- Alizarin Crimson
- Unbleached Titanium
- Titanium White

The branch deliberately does **not** add a giant catalog. The engine is tuned around this real palette first.

## Spectral integration

### Internal architecture

The refactor introduces a dedicated adapter layer:

- `src/lib/vendor/spectral.ts`
  - local vendored Spectral.js-derived Kubelka-Munk core
  - `SpectralColor`
  - spectral mixing and OKLab distance helpers
- `src/lib/color/spectralMixing.ts`
  - the app-facing adapter
  - converts paint definitions into spectral inputs
  - applies tinting-strength metadata
  - accepts weighted recipes
  - returns deterministic predicted hex, RGB, OKLab, and OKLCh output

The rest of the app calls the adapter, **not Spectral internals directly**.

### Why vendor the core locally?

This app must remain fully local-only and deterministic. Keeping the spectral engine code in-repo makes the mixing model:

- available offline
- version-stable for this branch
- testable in the same codebase
- insulated from registry/network issues

## How the engine works now

1. Parse the target color.
2. Analyze the target in a perceptual, painter-friendly way using spectral-derived OKLab / OKLCh data.
3. Generate deterministic 1-paint, 2-paint, and 3-paint candidate recipes from the enabled palette.
4. Prune obviously implausible candidates using paint heuristics such as:
   - tint strength
   - dominance penalty
   - recommended maximum share
   - preferred role
5. Predict every candidate using the spectral adapter.
6. Score recipes according to the selected ranking mode.
7. Build deterministic badges, explanations, and practical mixing guidance.
8. Simplify internal ratios into physically mixable display ratios.

## Paint model and heuristics

Each seed paint can now carry lightweight heuristic metadata such as:

- `tintStrength`
- `naturalBias`
- `commonUse`
- `dominancePenalty`
- `darkeningStrength`
- `mutingStrength`
- `chromaRetention`
- `recommendedMaxShare`
- `preferredRole`
- `spectral.tintingStrength`

These fields support:

- candidate pruning
- painter-friendly ranking
- support-paint penalties
- chromatic build bonuses
- guidance text
- deterministic mix strategy output

## Ranking modes

### 1. Painter-Friendly Balanced

Default mode.

Priorities:

1. spectral plausibility
2. hue-family correctness
3. believable painterly construction path
4. value fit
5. saturation / chroma fit
6. usability / simplicity

### 2. Strict Closest Color

This mode stays deterministic and comparatively literal.

- minimizes the raw spectral color difference
- applies minimal painter heuristics
- useful when you want the closest numeric spectral result first

### 3. Simpler Recipes Preferred

This mode still uses the spectral engine, but leans harder toward recipe usability.

- stronger complexity pressure
- still respects hue-family plausibility
- useful when you want practical palette setup speed

## Score breakdown

Each ranked recipe exposes a deterministic score breakdown with fields such as:

- `spectralDistance`
- `valueDifference`
- `hueDifference`
- `saturationDifference`
- `chromaDifference`
- `complexityPenalty`
- `hueFamilyPenalty`
- `constructionPenalty`
- `supportPenalty`
- `dominancePenalty`
- `neutralizerPenalty`
- `blackPenalty`
- `whitePenalty`
- `singlePaintPenalty`
- `naturalMixBonus`
- `chromaticPathBonus`
- `vividTargetPenalty`
- `finalScore`

Lower final score is better.

## Practical ratios

The engine keeps exact percentages internally, but recipe cards prefer readable, physical mixing ratios.

Examples:

- an exact internal split may simplify to `17:3`
- the practical displayed ratio may become `6:1`

This helps recipes stay:

- easier to mix by hand
- easier to remember
- easier to repeat
- less cluttered for 3-color suggestions

## Target analysis and guidance

The app still provides target analysis, but it is now tuned around the spectral engine:

- value classification
- hue family
- saturation classification
- palette-aware guidance

Examples of the intended behavior:

- vivid greens are encouraged to start with yellow + blue first
- olive greens are encouraged to build hue first, then mute or darken with support paint
- muted neutrals are steered toward earth colors when appropriate
- black-heavy shortcuts are penalized when they erase the intended hue family

## UI / UX preserved in the refactor

This branch keeps the current UX shell intact:

- explicit **Generate Recipes** button
- no auto-generation while typing
- loading state
- stale-results warning
- saved recipes
- paint inventory management
- local persistence

The recipe cards were updated to better surface spectral-era information such as:

- target vs predicted swatches
- hue-family comparison
- value/chroma fit
- practical ratio output
- mix guidance and palette strategy
- richer score breakdown labels

## Setup

```bash
npm install
npm run dev
```

## Testing

```bash
npm test
```

The test suite covers:

- spectral adapter determinism and sanity
- engine ranking behavior
- practical ratio determinism
- generate-on-click / stale-results / loading state logic
- recipe card rendering
- storage sanitization and old-data safety

## Build

```bash
npm run build
```

## Suggested workflow

1. Verify the enabled paints match what you physically have on hand.
2. Enter or pick the target color.
3. Read the target analysis before mixing.
4. Generate recipes.
5. Start with the top result’s practical ratio.
6. Follow the strategy notes: establish hue first when needed, then correct value and chroma.
7. Save any recipe that becomes a reliable physical starting point.

## Important expectations

This app is designed to help with:

- palette planning
- believable starting mixes
- hue/value/chroma tradeoff awareness
- practical ratio setup
- painterly decision-making

It does **not** promise:

- exact wet-paint matches from screen color alone
- manufacturer-grade spectral profiling
- lab-grade color matching certainty

## Project structure

```text
src/
  app/
  components/
  features/
    mixer/
    paints/
    recipes/
  lib/
    color/
    storage/
    utils/
    vendor/
  test/
  types/
```

## Notes

- For the same enabled palette, target, and settings, the engine produces the same results every time.
- The spectral core is wrapped so paint modeling, scoring, and UI logic remain maintainable.
- Seed paint definitions can continue to be iterated over time as better real-world tuning is discovered.
