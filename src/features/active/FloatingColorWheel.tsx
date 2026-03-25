import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import styles from './ActivePaintingPage.module.css';

export type WheelMode = 'painting' | 'view' | 'saved';

export type WheelColorNode = {
  id: string;
  hex: string;
  value: number;
  weight?: number;
  label?: string;
};

export type FloatingWheelPosition = {
  x: number;
  y: number;
};

type Props = {
  expanded: boolean;
  mode: WheelMode;
  position: FloatingWheelPosition;
  selectedHex?: string;
  nodes: WheelColorNode[];
  onToggleExpanded: () => void;
  onMove: (position: FloatingWheelPosition) => void;
  onChangeMode: (mode: WheelMode) => void;
  onSelectColor: (node: WheelColorNode) => void;
};

const modes: WheelMode[] = ['painting', 'view', 'saved'];

export const FloatingColorWheel = ({
  expanded,
  mode,
  position,
  selectedHex,
  nodes,
  onToggleExpanded,
  onMove,
  onChangeMode,
  onSelectColor,
}: Props) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    offsetX: number;
    offsetY: number;
    startClientX: number;
    startClientY: number;
    activated: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const DRAG_THRESHOLD_PX = 6;

  const getParentRect = () => {
    const offsetParent = rootRef.current?.offsetParent;
    if (offsetParent instanceof HTMLElement) {
      return offsetParent.getBoundingClientRect();
    }
    return { left: 0, top: 0 };
  };

  useEffect(() => {
    const onMoveDoc = (event: MouseEvent) => {
      const dragState = dragRef.current;
      if (!dragState) return;

      const deltaX = event.clientX - dragState.startClientX;
      const deltaY = event.clientY - dragState.startClientY;
      if (!dragState.activated && Math.hypot(deltaX, deltaY) >= DRAG_THRESHOLD_PX) {
        dragState.activated = true;
        setIsDragging(true);
      }

      if (!dragState.activated) return;

      const parentRect = getParentRect();
      onMove({
        x: Math.max(12, event.clientX - parentRect.left - dragState.offsetX),
        y: Math.max(12, event.clientY - parentRect.top - dragState.offsetY),
      });
    };

    const onUp = () => {
      if (dragRef.current?.activated) {
        suppressClickRef.current = true;
      }
      dragRef.current = null;
      setTimeout(() => setIsDragging(false), 0);
    };

    window.addEventListener('mousemove', onMoveDoc);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMoveDoc);
      window.removeEventListener('mouseup', onUp);
    };
  }, [onMove]);

  const ringNodes = useMemo(() => nodes.slice(0, 14), [nodes]);

  return (
    <div
      ref={rootRef}
      className={styles.floatingWheel}
      style={{ left: position.x, top: position.y }}
    >
      <button
        className={`${styles.floatingWheelOrb} ${selectedHex ? styles.floatingWheelOrbHasColor : ""}`}
        style={{ '--selected-color': selectedHex ?? '#6f7f96' } as CSSProperties}
        onMouseDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();

          const parentRect = getParentRect();
          const rect = rootRef.current?.getBoundingClientRect();
          if (!rect) return;

          dragRef.current = {
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
            startClientX: event.clientX,
            startClientY: event.clientY,
            activated: false,
          };

          // If the wheel is already out-of-sync with its parent coordinate space,
          // normalize on pickup so the drag starts with the exact grab point.
          onMove({
            x: rect.left - parentRect.left,
            y: rect.top - parentRect.top,
          });
        }}
        onClick={() => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          if (isDragging) return;
          onToggleExpanded();
        }}
        aria-label="Toggle color wheel"
      >
        <span className={styles.floatingWheelOrbInner} />
      </button>

      {expanded ? (
        <div className={styles.floatingWheelPanel}>
          <div className={styles.floatingWheelModes}>
            {modes.map((entry) => (
              <button
                key={entry}
                className={`${styles.floatingWheelMode} ${mode === entry ? styles.floatingWheelModeActive : ""}`}
                onClick={() => onChangeMode(entry)}
              >
                {entry}
              </button>
            ))}
          </div>

          <div className={styles.floatingWheelRing}>
            {ringNodes.map((node, index) => {
              const angle = (Math.PI * 2 * index) / Math.max(1, ringNodes.length) - Math.PI / 2;
              const radius = 98;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;
              const visualSize = 36 + Math.round((node.weight ?? 0.08) * 10);
              const hitSize = Math.max(46, visualSize + 8);

              return (
                <button
                  key={node.id}
                  className={`${styles.floatingWheelNode} ${selectedHex === node.hex ? styles.floatingWheelNodeActive : ""}`}
                  style={{
                    '--node-color': node.hex,
                    '--node-visual-size': `${visualSize}px`,
                    width: hitSize,
                    height: hitSize,
                    transform: `translate(${x}px, ${y}px)`,
                  } as CSSProperties}
                  title={`${node.label ?? node.hex} · V${node.value}`}
                  onClick={() => onSelectColor(node)}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};
