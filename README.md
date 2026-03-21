# Paint Mix Matcher

Paint Mix Matcher is a **local-only, deterministic spectral painting assistant** organized around three artist-facing experiences:

1. **Prep**
2. **Paint**
3. **Mixer**

The spectral recipe engine remains the core, but the product flow is now simplified around building a palette from an image, carrying that saved palette into painting mode, and using Mixer as a standalone utility.

## Simplified workflow

### Prep
Prep is now the main place to build a painting project from a reference image.

Use Prep to:

- upload a local reference image
- manually sample colors from the image
- automatically extract a candidate palette
- review candidate colors separately from the final painting palette
- add only chosen colors into the selected painting palette
- remove colors from the selected palette
- generate recipes for selected palette colors
- save the project locally with:
  - project title
  - reference image
  - extracted candidate palette
  - selected palette
  - selected recipes
  - painting status
  - mix statuses

### Paint
Paint is the lower-friction working board for active painting.

It keeps the most important execution cues front and center:

- saved reference image
- selected palette colors
- saved recipe for each selected color
- practical ratio
- swatch comparison
- mix path
- next adjustment suggestions
- mix status

Paint intentionally avoids foregrounding dense technical scoring, distance metrics, and ranking breakdowns.

### Mixer
Mixer remains a standalone utility for one-off color lookups.

The simplified Mixer emphasizes:

- target / predicted swatch comparison
- practical ratio
- recipe ingredients
- next adjustments
- optional technical details disclosure

## Navigation

Top-level navigation is now:

- **Prep**
- **Paint**
- **Mixer**
- **Projects**
- **My Paints**

Reference sampling is no longer treated like a separate product area. It now lives inside **Prep**.

## Core product principles

The app remains:

- **local-only**
- **deterministic**
- **browser-based**
- **backend-free**
- **auth-free**
- **cloud-sync-free**
- **external-API-free** for core functionality

All state stays in browser `localStorage`.

## Spectral engine architecture

The spectral engine still powers recipe generation.

Primary implementation files:

- `src/lib/vendor/spectral.ts`
- `src/lib/color/spectralMixing.ts`
- `src/lib/color/mixEngine.ts`
- `src/lib/color/referenceSampler.ts`
- `src/lib/storage/localState.ts`

## Storage and migration

Projects are stored in a session-backed project model that preserves compatibility with older saved data.

The loader now safely migrates and sanitizes:

- older session records
- legacy active session ids
- older sampler-only reference data
- missing newer recipe metadata

Where possible, older saved sampler data is folded into the currently selected project so existing local work is not lost.

## Default starter paints

The built-in starter palette includes:

- Mars Black
- Cadmium Yellow Medium
- Burnt Umber
- Ultramarine Blue
- Phthalo Blue
- Cadmium Red
- Alizarin Crimson
- Unbleached Titanium
- Titanium White

## Known limitations

- paint spectral data is still based on seeded approximations rather than measured production tubes
- image prep is intentionally lightweight and local-only, not a full masking / segmentation pipeline
- projects are stored only in the current browser environment
- there is no sync across devices

## Development

```bash
npm install
npm run dev
npm test
npm run build
```
