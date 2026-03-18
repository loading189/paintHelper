# Paint Mix Matcher

Paint Mix Matcher is a **local-only, deterministic painter's assistant** for planning mixtures with the paints you already own.

It is designed to get you into the ballpark with recipes that make **painterly sense**, not to pretend it can perfectly simulate real pigment physics.

## What the app does

- Manages a local paint inventory with enable/disable controls, metadata, search, and JSON import/export.
- Accepts a target hex color through text input or the native color picker.
- Analyzes the target into painter-friendly descriptors:
  - normalized hex
  - RGB
  - value classification
  - hue family
  - saturation classification
- Generates deterministic 1-paint, 2-paint, and 3-paint candidate mixes from the enabled inventory only.
- Scores recipes with a painter-friendly heuristic model that balances:
  - base color distance
  - value difference
  - hue difference
  - saturation difference
  - complexity
  - black-only / white-only shortcut penalties
  - earth-tone bonuses for muted targets
- Shows recipe badges, quality labels, guidance text, and a “Why this ranked” breakdown.
- Stores paints, settings, recent target colors, and saved recipes in `localStorage` only.

## Product boundaries

This app intentionally remains simple and local:

- No backend
- No authentication
- No server logic
- No cloud sync
- No AI/LLM features
- No required external API for core functionality
- No true spectral or laboratory-grade pigment simulation in this pass

## Setup

```bash
npm install
npm run dev
```

Open the local Vite URL shown in your terminal.

## Testing

```bash
npm test
```

## Build

```bash
npm run build
```

## Painter-friendly deterministic engine

Paint Mix Matcher does **not** attempt Kubelka-Munk, spectral reflectance, or true subtractive pigment physics.

Instead, it uses a deterministic heuristic workflow:

1. Parse the target and enabled paint colors from hex to sRGB.
2. Convert them to linear RGB for blending.
3. Generate discrete candidate recipes using the enabled paint inventory only.
4. Predict each candidate mix with a weighted linear RGB average.
5. Analyze both target and candidate for:
   - value
   - hue proxy / hue family
   - saturation / chroma
6. Build a structured score breakdown for every candidate.
7. Rank recipes using the selected ranking mode.
8. Suppress redundant results, preferring simpler recipes when the predicted colors are nearly the same.

The result is a **deterministic ballpark mixing assistant** that aims to be more useful to painters than pure linear-RGB distance alone.

## Ranking modes

### 1. Painter-Friendly Balanced (default)

Best general-purpose mode.

- Balances color distance with value, hue, and saturation differences.
- Penalizes black-only and white-only shortcut answers when they are not very painter-useful.
- Slightly favors practical mixtures and natural neutral handling.

### 2. Strict Closest Color

This is the original-style behavior.

- Uses the raw base color distance as the ranking driver.
- Useful when you want the mathematically closest digital match.
- Less painter-aware, especially near blacks, whites, and muted targets.

### 3. Simpler Recipes Preferred

Useful when you want easier palette execution.

- Still considers value, hue, and saturation.
- Applies a stronger complexity penalty.
- Helps bubble up mixtures that are easier to mix and repeat.

## Score breakdown

Each ranked recipe carries a deterministic score model with:

- `baseDistance`
- `valueDifference`
- `hueDifference`
- `saturationDifference`
- `complexityPenalty`
- `blackPenalty`
- `whitePenalty`
- `singlePaintPenalty`
- `earthToneBonus`
- `finalScore`

Lower final score is better.

### How to interpret the score in practice

- **Excellent starting point**: already very close; begin here and fine-tune by eye.
- **Strong starting point**: solid route with manageable visual adjustment.
- **Usable starting point**: directionally helpful but may need meaningful tweaking.
- **Rough direction only**: useful for planning, not likely the final mix.

## Seed palette

The default starter palette is tuned to the current intended inventory:

- Mars Black
- Cadmium Yellow Medium
- Burnt Umber
- Ultramarine Blue
- Phthalo Blue
- Cadmium Red
- Alizarin Crimson
- Unbleached Titanium
- Titanium White

Each seed paint can carry heuristic metadata such as tint strength, natural bias, common use, and dominance penalty to support painter-friendly ranking and deterministic guidance.

## Suggested workflow

1. Review the starter inventory and disable any tubes you do not actually have on hand.
2. Enter the target color.
3. Read the target analysis first so you understand the value, hue family, and saturation direction.
4. Compare the top recipes by score, badges, and “Why this ranked”.
5. Use the mix strategy panel to decide what paint to start with and which additions should be made cautiously.
6. Mix physically and adjust by eye.

## Important expectations

Paint Mix Matcher is meant to help with:

- palette planning
- mise en place
- practical first-pass recipes
- understanding value / hue / chroma tradeoffs

It is **not** meant to guarantee a perfect wet-paint match from screen color alone.

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

## Notes

- All persistence is local to the current browser/profile because storage uses `localStorage`.
- For the same inventory, target, and settings, the engine produces the same ranked output every time.
- The architecture keeps analysis and scoring logic in pure functions so the engine stays fast, readable, and testable.
