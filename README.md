# Paint Mix Matcher

Paint Mix Matcher is a **local-only, deterministic digital studio assistant** for realism-oriented acrylic painting.

The app still includes the original single-color spectral mixer, but it now grows into a broader workflow tool:

- plan a painting session before you start
- build and organize target colors for the painting
- generate deterministic spectral recipe options per target
- lock the recipes you actually want to use
- move into an active painting dashboard with only the relevant swatches and guidance
- keep everything local in browser storage with no backend, auth, or cloud sync

## What changed in this phase

The product is no longer only:

- “find a recipe for one target color”

It is now also:

- “help me prepare for a painting”
- “help me mix the colors I will need”
- “help me keep the important mixes visible while painting”
- “help me understand what to adjust next”

## Core workflow

### 1. Mixer

The original mixer remains available as a focused single-target tool.

It still preserves the existing UX wins:

- **Generate Recipes** only runs on click
- no auto-generation while typing
- loading state
- stale-results notice
- practical ratio shown before deeper technical detail

Use Mixer when you want a fast isolated color lookup or when you want to reload an old saved recipe target.

### 2. Painting Prep

Painting Prep is the new planning board.

Use it to:

- create or open a painting session
- describe the subject, lighting, mood, and canvas notes
- add target colors with labels like `leaf highlight`, `skin midtone`, or `background neutral`
- generate recipe options for each target using the existing spectral engine
- choose and lock preferred recipes
- include targets on the active painting board
- generate deterministic target families and value ladders

Each target can store:

- target hex
- label
- notes
- area/family grouping
- value role
- priority
- recipe options
- selected recipe
- prep status
- mix status

### 3. Active Painting

Active Painting is the simplified working dashboard for use while painting.

It emphasizes:

- large swatches
- practical ratio
- practical percentages
- selected recipe text
- mix status controls
- next-adjustment suggestions
- mix path / order guidance
- pinning important colors to the top

This view intentionally shows only session-selected colors so the working board stays glanceable.

### 4. Sessions / Archive

Sessions are now first-class persisted records.

A session connects:

- prep notes
- target colors
- stored recipe options
- locked recipe selections
- active board inclusion
- pinning
- mix status tracking

You can:

- create sessions
- duplicate sessions
- change status (`planning`, `active`, `completed`, `archived`)
- delete sessions
- reopen them later without losing selected recipes

## Product boundaries

The app intentionally remains:

- local-only
- deterministic
- browser-based
- backend-free
- auth-free
- cloud-sync-free
- external-API-free for core functionality

All paints, settings, saved recipes, recent targets, and painting sessions remain in **`localStorage` only**.

## Default on-hand palette

The built-in palette is still intentionally limited to the current on-hand nine paints:

- Mars Black
- Cadmium Yellow Medium
- Burnt Umber
- Ultramarine Blue
- Phthalo Blue
- Cadmium Red
- Alizarin Crimson
- Unbleached Titanium
- Titanium White

The seed paints are still **approximations**, not measured manufacturer spectral scans.

## Spectral engine architecture

The app continues to use the same local spectral core.

### Core files

- `src/lib/vendor/spectral.ts`
  - vendored Spectral.js-style Kubelka-Munk core
- `src/lib/color/spectralMixing.ts`
  - app-facing spectral adapter
- `src/lib/color/mixEngine.ts`
  - deterministic candidate generation + ranking
- `src/lib/color/adjustmentEngine.ts`
  - deterministic adjustment suggestions
- `src/lib/color/mixPathEngine.ts`
  - painterly mix order / dominance warnings
- `src/lib/color/achievability.ts`
  - achievable / limited palette signal
- `src/lib/color/valueRange.ts`
  - lighter / darker / muted target generation
- `src/lib/color/familyGeneration.ts`
  - prep-friendly target family generation

The rest of the app talks to these modules, not to Spectral internals directly.

## Session model

The new persistence model introduces two core records:

### `PaintingSession`

A session stores:

- metadata (`title`, notes, subject, lighting, mood, canvas)
- status
- ordered targets
- active target ids
- pinned target ids

### `PaintingTarget`

A target stores:

- labeled target color
- target notes / area / family
- priority and value role
- generated recipe options
- selected recipe and lock state
- prep state
- mix state

## Advanced painter-focused features

### Practical ratios remain primary

Every recipe still stores exact weighting, but the UI keeps the **practical ratio** as the main physical instruction.

### Next-adjustment engine expansion

The app now surfaces richer deterministic adjustments such as:

- too dark / too light
- too warm / too cool
- too saturated / too muted
- hue-specific steering suggestions

These are ordered as:

- primary
- secondary
- optional

### Mix path / mix order

Recipes can now include a deterministic mix path such as:

- what to start with as the base pile
- which paint should enter next to build hue
- which paint should be reserved for support or muting

### Stability / dominance warnings

Helpful warnings appear when a recipe is especially easy to overshoot, for example with:

- Phthalo Blue
- Titanium White
- Burnt Umber acting mainly as a natural mute

### Achievability signal

Recipes can surface a restrained palette-grounded signal such as:

- strongly achievable with current palette
- workable with refinement
- closest achievable with current palette

### Value ladder and family generation

From a session target you can generate deterministic related targets such as:

- lighter
- darker
- muted
- highlight / midtone / shadow family variants

These are intended to support realism planning, not endless automatic exploration.

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

Uses the raw closest spectral result with minimal painter heuristics.

### 3. Simpler Recipes Preferred

Still spectral and deterministic, but gives a small edge to simpler close solutions.

## Persistence and migration

The storage layer now safely handles:

- older app state without sessions
- older saved recipes missing newer workflow fields
- persisted sessions with selected recipes
- local-only session status / pinning / active target tracking

If older data is incomplete, the app sanitizes it instead of crashing.

## UI direction

The interface keeps the neutral studio-style direction and expands it into a workflow-oriented information architecture:

- Mixer
- Painting Prep
- Active Painting
- My Paints
- Saved Recipes
- Sessions

The design goals remain:

- swatch-heavy presentation
- restrained neutral surrounds
- calm spacing and hierarchy
- painter-first wording instead of technical dashboard language

## What the app does not try to be

This is still **not**:

- a backend system
- a cloud product
- a social tool
- a giant manufacturer paint catalog
- a spectral-lab guarantee

It is a deterministic local planning and mixing assistant grounded in the current on-hand palette.

## Setup

```bash
npm install
npm run dev
```

## Testing

```bash
npm test
npm run build
```

Current coverage includes:

- existing spectral recipe flow
- session creation / persistence
- target add + recipe lock workflow
- active dashboard mix status handling
- family generation and value ladder helpers
- expanded next-adjustment ordering
- mix path generation
- achievability detection
- storage migration safety
- prep / active page rendering
- build and type safety
