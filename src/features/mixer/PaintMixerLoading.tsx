export const PaintMixerLoading = () => {
  const strokes = ['#d6d3d1', '#a8a29e', '#78716c'];

  return (
    <div className="rounded-3xl border border-stone-200 bg-stone-100/80 px-4 py-4" role="status" aria-live="polite">
      <div className="flex items-center gap-4">
        <div className="flex items-end gap-2" aria-hidden="true">
          {strokes.map((color, index) => (
            <span
              key={color}
              className="paint-loader-stroke inline-block h-8 w-2.5 rounded-full"
              style={{ backgroundColor: color, animationDelay: `${index * 120}ms` }}
            />
          ))}
        </div>
        <div>
          <p className="text-sm font-semibold text-stone-900">Mixing spectral swatches…</p>
          <p className="text-xs text-stone-600">Holding briefly so the result feels deliberate, not twitchy.</p>
        </div>
      </div>
    </div>
  );
};
