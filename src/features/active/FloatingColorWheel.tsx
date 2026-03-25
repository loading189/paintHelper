import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

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
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const dragDistanceRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const onMoveDoc = (event: MouseEvent) => {
      if (!dragRef.current) return;
      dragDistanceRef.current += Math.abs(event.movementX) + Math.abs(event.movementY);
      if (dragDistanceRef.current > 3) {
        setIsDragging(true);
      }
      onMove({
        x: Math.max(12, event.clientX - dragRef.current.dx),
        y: Math.max(12, event.clientY - dragRef.current.dy),
      });
    };

    const onUp = () => {
      dragRef.current = null;
      dragDistanceRef.current = 0;
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
      className={`floating-wheel ${expanded ? 'is-expanded' : ''}`}
      style={{ left: position.x, top: position.y }}
    >
      <button
        className={`floating-wheel-orb ${selectedHex ? 'has-color' : ''}`}
        style={{ '--selected-color': selectedHex ?? '#6f7f96' } as CSSProperties}
        onMouseDown={(event) => {
          if (event.button !== 0) return;
          const rect = rootRef.current?.getBoundingClientRect();
          if (!rect) return;
          dragRef.current = {
            dx: event.clientX - rect.left,
            dy: event.clientY - rect.top,
          };
          dragDistanceRef.current = 0;
        }}
        onClick={() => {
          if (isDragging) return;
          onToggleExpanded();
        }}
        aria-label="Toggle color wheel"
      >
        <span className="floating-wheel-orb__inner" />
      </button>

      {expanded ? (
        <div className="floating-wheel-panel">
          <div className="floating-wheel-modes">
            {modes.map((entry) => (
              <button
                key={entry}
                className={`floating-wheel-mode ${mode === entry ? 'active' : ''}`}
                onClick={() => onChangeMode(entry)}
              >
                {entry}
              </button>
            ))}
          </div>

          <div className="floating-wheel-ring">
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
                  className={`floating-wheel-node ${selectedHex === node.hex ? 'active' : ''}`}
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
