export type UsedTrayColor = {
  id: string;
  hex: string;
  value: number;
  label?: string;
};

type Props = {
  usedColors: UsedTrayColor[];
  activeHex?: string;
  onSelect: (color: UsedTrayColor) => void;
};

export const UsedColorsTray = ({ usedColors, activeHex, onSelect }: Props) => (
  <section className="paint-used-tray">
    <div className="paint-used-tray__header">
      <p className="studio-kicker">Used colors in painting</p>
      <span className="text-xs text-[color:var(--text-subtle)]">{usedColors.length} saved</span>
    </div>

    <div className="paint-used-tray__rail">
      {usedColors.length ? (
        usedColors.map((color) => (
          <button
            key={color.id}
            className={`paint-used-chip ${activeHex === color.hex ? 'active' : ''}`}
            onClick={() => onSelect(color)}
            title={`${color.hex} · V${color.value}`}
          >
            <span className="paint-used-chip__swatch" style={{ backgroundColor: color.hex }} />
            <span>{color.hex}</span>
          </button>
        ))
      ) : (
        <p className="text-xs text-[color:var(--text-muted)]">Mark colors as used to build your in-painting palette.</p>
      )}
    </div>
  </section>
);
