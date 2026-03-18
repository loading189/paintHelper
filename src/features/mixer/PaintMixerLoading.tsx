export const PaintMixerLoading = () => {
  const swatches = ['#0F172A', '#0369A1', '#F59E0B'];

  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="flex items-end gap-2" aria-hidden="true">
          {swatches.map((color, index) => (
            <span
              key={color}
              className="paint-loader-dot inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: color, animationDelay: `${index * 120}ms` }}
            />
          ))}
        </div>
        <div>
          <p className="text-sm font-semibold text-sky-900">Mixing palette swatches…</p>
          <p className="text-xs text-sky-700">Holding for a moment so the result feels deliberate.</p>
        </div>
      </div>
    </div>
  );
};
