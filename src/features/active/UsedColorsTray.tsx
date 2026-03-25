import { useEffect, useState } from 'react';

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
  onDelete: (colorId: string) => void;
};

export const UsedColorsTray = ({ usedColors, activeHex, onSelect, onDelete }: Props) => {
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!armedDeleteId) {
      return;
    }

    const timeout = setTimeout(() => setArmedDeleteId(null), 2200);
    return () => clearTimeout(timeout);
  }, [armedDeleteId]);

  const handleDelete = (colorId: string) => {
    if (armedDeleteId === colorId) {
      onDelete(colorId);
      setArmedDeleteId(null);
      return;
    }

    setArmedDeleteId(colorId);
  };

  return (
    <section className="paint-used-tray">
      <div className="paint-used-tray__header">
        <p className="studio-kicker">Used colors in painting</p>
        <span className="text-xs text-[color:var(--text-subtle)]">{usedColors.length} saved</span>
      </div>

      <div className="paint-used-tray__rail">
        {usedColors.length ? (
          usedColors.map((color) => {
            const confirmDelete = armedDeleteId === color.id;
            return (
              <div
                key={color.id}
                className={`paint-used-chip ${activeHex === color.hex ? 'active' : ''}`}
                title={`${color.hex} · V${color.value}`}
              >
                <button
                  type="button"
                  className="paint-used-chip__select"
                  onClick={() => onSelect(color)}
                >
                  <span className="paint-used-chip__swatch" style={{ backgroundColor: color.hex }} />
                  <span>{color.hex}</span>
                </button>

                <button
                  type="button"
                  className={`paint-used-chip__delete ${confirmDelete ? 'is-armed' : ''}`}
                  onClick={() => handleDelete(color.id)}
                  aria-label={confirmDelete ? `Confirm delete ${color.hex}` : `Delete ${color.hex}`}
                >
                  {confirmDelete ? 'Confirm' : '×'}
                </button>
              </div>
            );
          })
        ) : (
          <p className="text-xs text-[color:var(--text-muted)]">Mark colors as used to build your in-painting palette.</p>
        )}
      </div>
    </section>
  );
};
