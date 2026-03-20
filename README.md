# Paint Mix Matcher

Paint Mix Matcher is now a **local-only, deterministic spectral painting workstation** for artists who want to move from reference analysis to actual palette preparation and live painting without leaving one application.

This major release keeps the existing **Spectral.js-based paint prediction engine** as the source of truth, then expands the product into a workflow-first studio companion with:

- a premium dark workstation UI
- session-based planning and execution
- a reference image sampler with canvas-based picking
- averaged and smart sample modes
- deterministic palette extraction / color clustering
- expanded painting prep and active painting dashboards
- practical mix ratios, mix paths, adjustment guidance, and achievability signals

## Core product principles

The app intentionally remains:

- **local-only**
- **deterministic**
- **browser-based**
- **backend-free**
- **auth-free**
- **cloud-sync-free**
- **external-API-free** for core functionality

All paints, sessions, sampled colors, saved recipes, and prep state stay in **`localStorage` only**.

## What changed in this major release

The app is no longer just “find a recipe for one color.”

It is now a coherent painting workflow for:

1. building a painting session
2. sampling and organizing colors from a reference image
3. extracting a clustered palette automatically
4. generating deterministic spectral recipes
5. planning the palette in prep mode
6. painting from a simplified active dashboard
7. adjusting intelligently while painting

## Workspaces

The application is organized as a unified workstation shell with these workspaces:

- **Mixer** — direct target matching and recipe exploration
- **Painting Prep** — target board, recipe locking, value / family generation
- **Active Painting** — large swatches, practical ratios, live mix status tracking
- **Reference Sampler** — canvas-based image sampling and palette extraction
- **Sessions** — project switching and session lifecycle
- **My Paints** — on-hand inventory management
- **Saved Recipes** — archived local recipe references

## Spectral engine architecture

The app still uses the in-repo Spectral.js-style Kubelka–Munk stack as the color prediction core.

### Main spectral layers

- `src/lib/vendor/spectral.ts`
  - vendored spectral core and OKLab helpers
- `src/lib/color/spectralMixing.ts`
  - application-facing adapter around the spectral engine
- `src/lib/color/mixEngine.ts`
  - deterministic candidate generation, ranking, and recipe enrichment
- `src/lib/session/workflow.ts`
  - session-facing spectral helpers such as mix paths, achievability, and family tools

The UI talks to these adapters rather than reaching into Spectral internals directly.

## Reference sampler

The new reference sampler is a first-class workspace.

### Capabilities

- upload a local JPG / PNG / WebP reference
- render the image into a controlled HTML canvas
- click to sample a color from the image
- inspect color transitions with a loupe
- sample as:
  - **single pixel**
  - **averaged radius**
  - **smart weighted sample**
- collect manual samples into a sample tray
- rename sampled colors before sending them into a session
- extract a deterministic clustered palette in-browser
- send samples or extracted colors directly into **Painting Prep**

### Why a controlled canvas sampler?

Because it keeps the workflow:

- precise
- deterministic
- local-only
- extensible for future tools such as pan/zoom or masks

The implementation lives in:

- `src/features/reference/ReferenceSamplerCanvas.tsx`
- `src/features/reference/ReferenceSamplerPage.tsx`
- `src/lib/color/referenceSampler.ts`

## Palette extraction / clustering

Automatic palette extraction runs entirely in the browser.

### Current approach

- downsample the image deterministically
- cluster RGB samples with deterministic seeded k-means-style grouping
- sort by cluster population
- remove duplicates
- present grouped palette candidates for session import

### Goals of the clustering system

- deterministic output
- useful painterly grouping
- reduced noisy duplicates
- preservation of broad, relevant color families

This system is intentionally simple, explainable, and local.

## Painting prep board

Painting Prep has been expanded into a real palette planning board.

### Prep workflow

- edit the active session name and description
- add targets manually or from the reference sampler
- view targets in a board layout
- generate a top spectral recipe for a selected target
- review swatch comparisons
- inspect mix path, achievability, and adjustment guidance
- generate deterministic highlight / shadow / muted / accent variations
- sort targets by:
  - custom order
  - light to dark
  - family
  - priority

## Active painting dashboard

Active Painting is optimized for actual mixing and brushwork rather than deep analysis.

### Dashboard emphasis

- large swatches
- practical ratio display
- quick ingredient list
- primary next-adjustment cue
- mix path guidance
- mix status controls:
  - not mixed
  - mixed
  - adjusted
  - remix needed
- pinning and duplication for important colors

The goal is to feel more like a physical palette board translated into software than a developer dashboard.

## Advanced spectral helpers

This release expands the artist-facing guidance layer around the spectral engine.

### Included helpers

- **Practical ratios** for physical mixing
- **Mix path** instructions that prioritize painterly order
- **Next adjustments** based on target vs predicted comparison
- **Dominance warnings** for strong tinting paints, white, black, and earth colors
- **Achievability signals** for easy / moderate / challenging targets
- **Value / family generation** for related target sets
- **Optional glazing suggestion** when a direct mix looks difficult

These tools are deterministic and intentionally restrained.

## Default on-hand palette

The built-in starter palette remains the same initial working set:

- Mars Black
- Cadmium Yellow Medium
- Burnt Umber
- Ultramarine Blue
- Phthalo Blue
- Cadmium Red
- Alizarin Crimson
- Unbleached Titanium
- Titanium White

These are still **seed approximations**, not lab-measured scans of specific tube batches.

## Persistence and migration

State is stored under a single browser `localStorage` key and now includes:

- paints
- saved recipes
- recent targets
- user settings
- painting sessions
- current session selection
- reference sampler state

The storage loader sanitizes older saved data so legacy states do not crash the app when new fields are missing.

## How recipe generation still works

1. Normalize the target color.
2. Analyze it perceptually in OKLab / OKLCh terms.
3. Generate deterministic one-, two-, and three-paint candidates.
4. Filter implausible candidates with painter-aware heuristics.
5. Predict each candidate with the spectral engine.
6. Rank results according to the selected mode.
7. Enrich the best results with practical ratios, mix path, and next-adjustment guidance.

## Ranking modes

### Painter-Friendly Balanced
Default mode focused on believable studio use.

### Strict Closest Color
Prioritizes raw spectral closeness with minimal painter heuristics.

### Simpler Recipes Preferred
Keeps the spectral engine central while nudging close solutions toward setup simplicity.

## Known limitations

This app is still a **painter’s assistant**, not a lab guarantee.

Important limitations remain:

- seed paints are approximations, not measured production tubes
- the reference sampler currently prioritizes precise picking and clustering over advanced masking workflows
- palette extraction is deterministic and useful, but intentionally lightweight rather than research-grade segmentation
- no backend means no cross-device sync or team workflows
- browser rendering of uploaded references may vary slightly by environment even though the clustering flow is deterministic inside a given browser/runtime

## Development

```bash
npm install
npm run dev
npm test
npm run build
```

## Test coverage in this release

The suite covers:

- session persistence and migration
- prep workflow helpers
- active workflow spectral enrichment
- reference sampling logic
- averaged sampling behavior
- deterministic palette extraction
- clustering stability
- workstation shell rendering
- existing mixer behavior
- type-safe production build

## Product direction

Paint Mix Matcher is now designed to feel like:

- a luxury digital color lab
- a painter’s spectral workstation
- a studio planning board
- a serious local creative instrument

without becoming a backend platform, a cloud workflow, or a generic dashboard product.
