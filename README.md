# Paint Mix Matcher

Paint Mix Matcher is a local-only desktop-first web app for artists who want fast, deterministic paint-mix suggestions using the paints they already own.

## What the app does

- Lets you manage a local paint inventory with metadata, enable/disable controls, search, and JSON import/export.
- Accepts a target hex color through text input or a native color picker.
- Calculates the closest 1-paint, 2-paint, and 3-paint recipes using enabled paints only.
- Stores paints, saved recipes, recent target colors, and lightweight settings in `localStorage`.
- Saves promising recipes locally so they can be renamed, annotated, and reloaded into the mixer.

## Local-only product constraints

This app is intentionally simple and local:

- No backend
- No authentication
- No server logic
- No cloud sync
- No required API dependency for core features
- Browser-only persistence with `localStorage`

## Setup

```bash
npm install
npm run dev
```

Open the local Vite URL shown in your terminal.

## Testing

```bash
npm run test
```

## Build

```bash
npm run build
```

## MVP color-mixing approximation

Paint Mix Matcher does **not** attempt true subtractive pigment simulation.

Instead, the MVP engine uses a deterministic approximation:

1. Parse the target hex and every enabled paint hex into sRGB.
2. Normalize channel values to `0..1`.
3. Convert sRGB into linear RGB.
4. Treat each paint as a linear RGB vector.
5. Generate candidate recipes for 1-paint, 2-paint, and 3-paint combinations.
6. Generate discrete weight splits at a configurable step size, with `10%` as the default.
7. Compute the weighted average in linear RGB for each candidate.
8. Score each candidate with Euclidean distance in linear RGB.
9. Rank recipes by smallest distance and suppress near-duplicates so the top 3 feel distinct.
10. Convert each predicted mix back to display hex for the UI.

This makes the app a **deterministic ballpark mixing assistant**, not a true pigment simulator or scientific color-matching tool.

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
  test/
  types/
```

## Suggested workflow

1. Review or customize the starter paint set on first run.
2. Enable only the paints you actually want the engine to consider.
3. Enter a target hex from your reference palette.
4. Compare the top ranked recipes and predicted swatches.
5. Save the closest options and adjust by eye at the palette.

## Notes

- Data is stored per browser/profile because persistence uses `localStorage`.
- The recipe engine is deterministic for the same paint inventory, settings, and target hex.
- The architecture keeps color math in pure functions so future distance metrics or subtractive models can be swapped in later.
