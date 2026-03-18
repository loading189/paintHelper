# Paint Mix Matcher

Paint Mix Matcher is a **local-only, deterministic painter’s assistant** for planning mixtures with the nine paints you actually have on hand.

The app uses a local **Spectral.js-style pigment mixing engine** as the source of truth for predicted swatches, then layers painter-friendly ranking, practical ratio display, and next-step adjustment guidance on top.

## What this app is for

This project is meant to be a **believable starting-mix assistant**, not a laboratory guarantee.

It helps you:

- compare a target color against predicted palette mixes
- start from a practical hand-mixable ratio instead of abstract numeric output
- keep hue-building paints primary for chromatic targets
- see likely next adjustments if the first pile is close but not perfect

It does **not** try to be:

- a backend service
- a cloud app
- an inventory platform
- a paint research database
- a lab-grade color matching guarantee

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

The built-in palette stays limited to the current nine on-hand paints:

- Mars Black
- Cadmium Yellow Medium
- Burnt Umber
- Ultramarine Blue
- Phthalo Blue
- Cadmium Red
- Alizarin Crimson
- Unbleached Titanium
- Titanium White

The seed paints are still **approximations of the actual tubes**, not measured spectral scans of a specific brand batch.

## Neutral studio-style UI

The interface is intentionally kept **neutral and restrained** so target and predicted swatches are easier to judge.

Design principles in this pass:

- neutral gray surroundings instead of colorful UI chrome
- matching framed target/predicted swatches for cleaner comparison
- practical ratio shown as the primary mixing instruction
- exact percentages kept visible, but secondary
- low-noise badges, spacing, and typography tuned for studio use rather than dashboard flash

## Spectral integration

### Internal architecture

The app keeps a dedicated spectral adapter layer:

- `src/lib/vendor/spectral.ts`
  - local vendored Spectral.js-derived Kubelka-Munk core
  - spectral mixing and OKLab helpers
- `src/lib/color/spectralMixing.ts`
  - app-facing adapter
  - converts paint definitions into spectral inputs
  - applies tinting-strength metadata
  - accepts weighted recipes
  - returns deterministic predicted hex, RGB, OKLab, and OKLCh output

The rest of the app talks to the adapter, **not Spectral internals directly**.

### Why keep Spectral local?

Because the app must remain fully local-only and deterministic, the pigment-mixing core is kept in-repo so it stays:

- available offline
- version-stable
- testable in the same codebase
- free from network/runtime surprises

## How recipe generation works

1. Parse and normalize the target color.
2. Analyze it in spectral-derived perceptual terms using OKLab / OKLCh.
3. Generate deterministic 1-paint, 2-paint, and 3-paint candidate recipes from enabled paints.
4. Prune implausible candidates with paint heuristics.
5. Predict each candidate with the spectral engine.
6. Rank results according to the selected mode.
7. Build deterministic practical guidance, why-this-ranked copy, and next-adjustment suggestions.

## Paint heuristics used in ranking

Each seed paint can carry lightweight heuristic metadata such as:

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

These heuristics now help with:

- dominant pigment clamping
- support-paint overuse control
- early-white penalties for chromatic targets
- painter-friendly chromatic-path bonuses
- next-step guidance and strategy notes

## Ranking modes

### 1. Painter-Friendly Balanced

Default mode.

Priorities:

1. spectral plausibility
2. hue-family correctness
3. believable painterly construction path
4. value fit
5. support-paint restraint
6. usability

### 2. Strict Closest Color

This mode minimizes raw spectral difference with minimal painter heuristics.

Use it when you want the closest numeric spectral result first, even if the recipe is less painterly.

### 3. Simpler Recipes Preferred

This mode still uses the spectral engine, but gives a little more preference to quick, practical setup.

- stronger complexity pressure
- slight edge to close 2-paint solutions
- still filtered by visible plausibility

## Practical ratios vs exact percentages

The app stores exact recipe weighting, but it now shows two clearly separated representations:

### Practical ratio

This is the **main physical mixing instruction**.

Examples:

- exact ratio: `17:3`
- practical ratio: `6:1`

The practical ratio is what you should use first when laying out palette piles.

### Exact percentages

Exact percentages remain available as supporting detail.

Two important rules now apply:

- the visible percentages on the main recipe card align with the displayed practical ratio when that ratio is the physical instruction
- the secondary exact percentages stay mathematically consistent with the stored exact ratio

That way the practical ratio, displayed shares, and recipe wording all agree.

## Next-adjustment suggestions

Each ranked recipe now includes deterministic **Next adjustments** suggestions.

These suggestions are grounded in the current on-hand palette and stay concise.

Typical categories include:

- value correction
- hue correction
- chroma correction
- naturalization / temperature correction

Examples:

- “Lift value with a small amount of Titanium White.”
- “Add a small touch more yellow to warm the green.”
- “Mute naturally with Burnt Umber before reaching for black.”

The goal is to make the first recipe feel more usable at the easel: not just “here is a mix,” but also “here is the next move if it lands slightly off.”

## Current painter-friendly tuning

This final pass keeps the existing spectral refactor, but tightens painter usability by:

- clamping strong pigments like Phthalo Blue more aggressively on muted targets
- keeping Mars Black in a support role for chromatic mixes
- discouraging early or excessive Titanium White for vivid/moderate chromatic targets
- avoiding support-paint stacking in top painter-mode results when a cleaner hue build is available
- giving close 2-paint solutions a slight usability edge without overriding clearly better 3-paint recipes

## What the app preserves

This pass keeps the current UX wins intact:

- explicit **Generate Recipes** button
- no auto-generation while typing
- loading state
- stale-results warning
- saved recipes
- paint inventory management
- local persistence
- spectral-based predicted swatches

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
- practical ratio and percentage consistency
- ranking and candidate-pruning behavior
- dominant-pigment and early-white tuning
- next-adjustment suggestion determinism
- recipe card rendering and loading UI
- generate-on-click / stale-results logic
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
6. Compare the predicted swatch against the target in the neutral UI.
7. Use the next-adjustment notes to nudge value, hue, or chroma after the first pile is on the palette.
8. Save any mix that becomes a dependable physical starting point.
