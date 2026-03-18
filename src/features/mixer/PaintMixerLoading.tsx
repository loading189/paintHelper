export const PaintMixerLoading = () => {
  const drops = ['#d8d0c6', '#a89581', '#6f7f89'];

  return (
    <div className="rounded-[28px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)]/90 px-4 py-4 shadow-sm" role="status" aria-live="polite">
      <div className="flex items-center gap-4">
        <div className="paint-loader-orbit flex items-center justify-center" aria-hidden="true">
          <div className="flex items-end gap-1.5">
            {drops.map((color, index) => (
              <span
                key={color}
                className="paint-loader-drop inline-block h-4 w-1.5 rounded-full"
                style={{ backgroundColor: color, animationDelay: `${index * 120}ms` }}
              />
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold tracking-[-0.01em] text-[color:var(--text-strong)]">Building spectral paint studies…</p>
          <p className="mt-1 text-xs leading-5 text-[color:var(--text-muted)]">Holding briefly so the result reads like a considered lab pass, not a twitchy refresh.</p>
        </div>
      </div>
    </div>
  );
};
