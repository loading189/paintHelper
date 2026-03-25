import styles from './ActivePaintingPage.module.css';
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
    <section className={styles.paintUsedTray}>
      <div className={styles.paintUsedTrayHeader}>
        <p className="studio-kicker">Used colors in painting</p>
        <span className={styles.subtleText}>{usedColors.length} saved</span>
      </div>

      <div className={styles.paintUsedTrayRail}>
        {usedColors.length ? (
          usedColors.map((color) => {
            const confirmDelete = armedDeleteId === color.id;
            return (
              <div
                key={color.id}
                className={`${styles.paintUsedChip} ${activeHex === color.hex ? styles.paintUsedChipActive : ""}`}
                title={`${color.hex} · V${color.value}`}
              >
                <button
                  type="button"
                  className={styles.paintUsedChipSelect}
                  onClick={() => onSelect(color)}
                >
                  <span className={styles.paintUsedChipSwatch} style={{ backgroundColor: color.hex }} />
                  <span>{color.hex}</span>
                </button>

                <button
                  type="button"
                  className={`${styles.paintUsedChipDelete} ${confirmDelete ? styles.paintUsedChipDeleteArmed : ""}`}
                  onClick={() => handleDelete(color.id)}
                  aria-label={confirmDelete ? `Confirm delete ${color.hex}` : `Delete ${color.hex}`}
                >
                  {confirmDelete ? 'Confirm' : '×'}
                </button>
              </div>
            );
          })
        ) : (
          <p className={styles.metaText}>Mark colors as used to build your in-painting palette.</p>
        )}
      </div>
    </section>
  );
};
