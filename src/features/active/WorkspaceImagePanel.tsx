import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReferenceImageMeta } from '../../types/models';
import {
  classifyTemperature,
  extractVisibleClusters,
  fitViewport,
  getVisibleImageBounds,
  imageToScreenPoint,
  quantizeValueGrouping,
  rgbToHex,
  rgbToLuminance,
  sampleImageAtPoint,
  screenToImagePoint,
  toPainterValue,
  type DisplayMode,
  type GuideMode,
  type ViewportState,
  type VisibleColorCluster,
} from './workspaceUtils';

type HoverInfo = {
  point: { x: number; y: number };
  hex: string;
  value: number;
  luminance: number;
  localContrast: number;
};

type Props = {
  image?: ReferenceImageMeta;
  displayMode?: DisplayMode;
  guideMode?: GuideMode;
  onDisplayModeChange?: (mode: DisplayMode) => void;
  onGuideModeChange?: (mode: GuideMode) => void;
  sampleRadius?: number;
  visibleLimit?: number;
  pinnedHexes?: Set<string>;
  viewport: ViewportState | null;
  onViewportChange: (viewport: ViewportState) => void;
  onVisibleColorsChange: (colors: VisibleColorCluster[]) => void;
  onPaintingDominantsChange?: (colors: VisibleColorCluster[]) => void;
  onSample: (sample: { point: { x: number; y: number }; hex: string; value: number }) => void;
  onHover?: (hover: HoverInfo | null) => void;
};

const displayModes: Array<{ value: DisplayMode; label: string }> = [
  { value: 'color', label: 'Color' },
  { value: 'grayscale', label: 'Value' },
  { value: 'high-contrast-grayscale', label: 'Contrast' },
];

const guideModes: Array<{ value: GuideMode; label: string }> = [
  { value: 'off', label: 'Guides Off' },
  { value: 'quadrants', label: 'Quadrants' },
  { value: 'grid-3', label: '3×3 Grid' },
];

export const WorkspaceImagePanel = ({
  image,
  displayMode = 'color',
  guideMode = 'off',
  onDisplayModeChange,
  onGuideModeChange,
  sampleRadius = 2,
  visibleLimit = 10,
  pinnedHexes,
  viewport,
  onViewportChange,
  onVisibleColorsChange,
  onPaintingDominantsChange,
  onSample,
  onHover,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [bitmap, setBitmap] = useState<ImageData | null>(null);
  const [dragging, setDragging] = useState<{ x: number; y: number } | null>(null);
  const [lastSample, setLastSample] = useState<{ point: { x: number; y: number }; hex: string; value: number } | null>(null);
  const [liveHover, setLiveHover] = useState<HoverInfo | null>(null);

  useEffect(() => {
    if (!image?.dataUrl) {
      setBitmap(null);
      setLastSample(null);
      setLiveHover(null);
      return;
    }

    const img = new Image();
    img.src = image.dataUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, img.width, img.height);
      setBitmap(data);

      if (!shellRef.current) return;
      const rect = shellRef.current.getBoundingClientRect();
      onViewportChange(fitViewport(img.width, img.height, rect.width, rect.height));

      const full = extractVisibleClusters({
        data: data.data,
        width: img.width,
        height: img.height,
        bounds: { x: 0, y: 0, width: img.width, height: img.height },
        maxColors: Math.max(10, visibleLimit),
        minPercent: 0.01,
        pinnedHexes: new Set<string>(),
      });
      onPaintingDominantsChange?.(full);
    };
  }, [image, onPaintingDominantsChange, onViewportChange, visibleLimit]);

  useEffect(() => {
    if (!bitmap || !viewport || !canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = viewport.containerWidth;
    canvas.height = viewport.containerHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scratch = document.createElement('canvas');
    scratch.width = bitmap.width;
    scratch.height = bitmap.height;
    const scratchCtx = scratch.getContext('2d');
    if (!scratchCtx) return;

    const displayImage = new ImageData(new Uint8ClampedArray(bitmap.data), bitmap.width, bitmap.height);
    if (displayMode !== 'color') {
      for (let i = 0; i < displayImage.data.length; i += 4) {
        const r = displayImage.data[i];
        const g = displayImage.data[i + 1];
        const b = displayImage.data[i + 2];
        const l = rgbToLuminance({ r, g, b });

        if (displayMode === 'grayscale') {
          const gray = Math.round(l * 255);
          displayImage.data[i] = gray;
          displayImage.data[i + 1] = gray;
          displayImage.data[i + 2] = gray;
        } else if (displayMode === 'high-contrast-grayscale') {
          const gray = Math.round(Math.pow(l, 0.8) * 255);
          displayImage.data[i] = gray;
          displayImage.data[i + 1] = gray;
          displayImage.data[i + 2] = gray;
        } else if (displayMode === 'muted') {
          const mid = (r + g + b) / 3;
          displayImage.data[i] = Math.round(mid + (r - mid) * 0.45);
          displayImage.data[i + 1] = Math.round(mid + (g - mid) * 0.45);
          displayImage.data[i + 2] = Math.round(mid + (b - mid) * 0.45);
        } else if (displayMode === 'edge-map') {
          const x = (i / 4) % bitmap.width;
          const y = Math.floor(i / 4 / bitmap.width);
          if (x > 0 && y > 0 && x < bitmap.width - 1 && y < bitmap.height - 1) {
            const leftIdx = i - 4;
            const rightIdx = i + 4;
            const upIdx = i - bitmap.width * 4;
            const downIdx = i + bitmap.width * 4;
            const gx =
              (bitmap.data[rightIdx] + bitmap.data[rightIdx + 1] + bitmap.data[rightIdx + 2]) -
              (bitmap.data[leftIdx] + bitmap.data[leftIdx + 1] + bitmap.data[leftIdx + 2]);
            const gy =
              (bitmap.data[downIdx] + bitmap.data[downIdx + 1] + bitmap.data[downIdx + 2]) -
              (bitmap.data[upIdx] + bitmap.data[upIdx + 1] + bitmap.data[upIdx + 2]);
            const mag = Math.min(255, Math.round(Math.sqrt(gx * gx + gy * gy) / 3));
            displayImage.data[i] = mag;
            displayImage.data[i + 1] = mag;
            displayImage.data[i + 2] = mag;
          }
        } else {
          const groups = displayMode === 'value-3' ? 3 : displayMode === 'value-5' ? 5 : 9;
          const q = quantizeValueGrouping(l, groups as 3 | 5 | 9);
          const normalized = groups === 9 ? 1 - (q - 1) / 8 : 1 - q / (groups - 1);
          const gray = Math.round(normalized * 255);
          displayImage.data[i] = gray;
          displayImage.data[i + 1] = gray;
          displayImage.data[i + 2] = gray;
        }
      }
    }

    scratchCtx.putImageData(displayImage, 0, 0);

    ctx.fillStyle = '#0D1117';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(scratch, viewport.offsetX, viewport.offsetY, bitmap.width * viewport.zoom, bitmap.height * viewport.zoom);

    const bounds = getVisibleImageBounds(viewport);
    const visible = extractVisibleClusters({
      data: bitmap.data,
      width: bitmap.width,
      height: bitmap.height,
      bounds,
      maxColors: visibleLimit,
      minPercent: 0.015,
      pinnedHexes: pinnedHexes ?? new Set<string>(),
    });

    onVisibleColorsChange(visible);
  }, [bitmap, displayMode, viewport, onVisibleColorsChange, visibleLimit, pinnedHexes]);

  const guides = useMemo(() => {
    if (!viewport || guideMode === 'off') {
      return [] as Array<{ x1: number; y1: number; x2: number; y2: number; major: boolean }>;
    }

    const lines: Array<{ x1: number; y1: number; x2: number; y2: number; major: boolean }> = [];
    const divisions = guideMode === 'quadrants' ? 2 : guideMode === 'grid-3' ? 3 : 4;

    for (let i = 1; i < divisions; i += 1) {
      const ratio = i / divisions;
      const vStart = imageToScreenPoint({ x: viewport.imageWidth * ratio, y: 0 }, viewport);
      const vEnd = imageToScreenPoint({ x: viewport.imageWidth * ratio, y: viewport.imageHeight }, viewport);
      const major = Math.abs(ratio - 0.5) < 0.001;
      lines.push({ x1: vStart.x, y1: vStart.y, x2: vEnd.x, y2: vEnd.y, major });

      const hStart = imageToScreenPoint({ x: 0, y: viewport.imageHeight * ratio }, viewport);
      const hEnd = imageToScreenPoint({ x: viewport.imageWidth, y: viewport.imageHeight * ratio }, viewport);
      lines.push({ x1: hStart.x, y1: hStart.y, x2: hEnd.x, y2: hEnd.y, major });
    }

    return lines;
  }, [guideMode, viewport]);

  const sampleMarker = useMemo(() => {
    if (!viewport || !lastSample) return null;
    return imageToScreenPoint(lastSample.point, viewport);
  }, [lastSample, viewport]);

  const hoverTemperature = liveHover ? classifyTemperature(liveHover.hex) : null;

  if (!image?.dataUrl) {
    return <div className="paint-reference-empty">Upload a reference image to start painting.</div>;
  }

  return (
    <div className="workspace-image-shell" ref={shellRef}>
      <canvas
        ref={canvasRef}
        className="workspace-image-canvas"
        onWheel={(event) => {
          event.preventDefault();
          if (!viewport) return;

          const rect = event.currentTarget.getBoundingClientRect();
          const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
          const imagePoint = screenToImagePoint(point, viewport);
          const zoomFactor = event.deltaY < 0 ? 1.12 : 0.89;
          const nextZoom = Math.max(0.1, Math.min(24, viewport.zoom * zoomFactor));

          onViewportChange({
            ...viewport,
            zoom: nextZoom,
            offsetX: point.x - imagePoint.x * nextZoom,
            offsetY: point.y - imagePoint.y * nextZoom,
          });
        }}
        onMouseDown={(event) => setDragging({ x: event.clientX, y: event.clientY })}
        onMouseUp={() => setDragging(null)}
        onMouseLeave={() => {
          setDragging(null);
          setLiveHover(null);
          onHover?.(null);
        }}
        onMouseMove={(event) => {
          if (!viewport || !bitmap) return;

          if (dragging) {
            const dx = event.clientX - dragging.x;
            const dy = event.clientY - dragging.y;
            setDragging({ x: event.clientX, y: event.clientY });
            onViewportChange({
              ...viewport,
              offsetX: viewport.offsetX + dx,
              offsetY: viewport.offsetY + dy,
            });
            return;
          }

          const rect = event.currentTarget.getBoundingClientRect();
          const screenPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
          const imagePoint = screenToImagePoint(screenPoint, viewport);
          const rgb = sampleImageAtPoint(bitmap.data, bitmap.width, bitmap.height, imagePoint, sampleRadius);
          const neighborhood = sampleImageAtPoint(bitmap.data, bitmap.width, bitmap.height, imagePoint, sampleRadius + 5);
          const localContrast = Math.round(Math.sqrt((rgb.r - neighborhood.r) ** 2 + (rgb.g - neighborhood.g) ** 2 + (rgb.b - neighborhood.b) ** 2));
          const luminance = rgbToLuminance(rgb);

          const hover: HoverInfo = {
            point: { x: Math.round(imagePoint.x), y: Math.round(imagePoint.y) },
            hex: rgbToHex(rgb),
            value: toPainterValue(luminance),
            luminance,
            localContrast,
          };

          setLiveHover(hover);
          onHover?.(hover);
        }}
        onClick={(event) => {
          if (!viewport || !bitmap) return;

          const rect = event.currentTarget.getBoundingClientRect();
          const screenPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
          const imagePoint = screenToImagePoint(screenPoint, viewport);
          const rgb = sampleImageAtPoint(bitmap.data, bitmap.width, bitmap.height, imagePoint, sampleRadius);
          const sample = {
            point: imagePoint,
            hex: rgbToHex(rgb),
            value: toPainterValue(rgbToLuminance(rgb)),
          };

          setLastSample(sample);
          onSample(sample);
        }}
      />

      {viewport ? (
        <svg className="workspace-overlay" width={viewport.containerWidth} height={viewport.containerHeight}>
          {guides.map((line) => (
            <line
              key={`${line.x1}-${line.y1}-${line.x2}-${line.y2}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={line.major ? 'rgba(255,255,255,0.52)' : 'rgba(255,255,255,0.3)'}
              strokeWidth={line.major ? 1.3 : 1}
              strokeDasharray={guideMode === 'quadrants' ? '0' : line.major ? '0' : '5 8'}
            />
          ))}

          {sampleMarker ? (
            <g className="workspace-sample-marker">
              <circle cx={sampleMarker.x} cy={sampleMarker.y} r={9} fill="none" stroke="white" strokeWidth={1.5} />
              <circle cx={sampleMarker.x} cy={sampleMarker.y} r={3.5} fill={lastSample?.hex ?? '#FFFFFF'} stroke="rgba(13,17,23,0.9)" strokeWidth={1} />
            </g>
          ) : null}
        </svg>
      ) : null}

      <div className="workspace-stage-hud workspace-stage-hud--top">
        <div className="workspace-stage-control-group">
          <span className="workspace-stage-control-label">Filter</span>
          <div className="workspace-stage-segmented">
            {displayModes.map((entry) => (
              <button
                key={entry.value}
                className={`workspace-stage-segment ${displayMode === entry.value ? 'active' : ''}`}
                onClick={() => onDisplayModeChange?.(entry.value)}
                type="button"
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
        <div className="workspace-stage-control-group">
          <span className="workspace-stage-control-label">Guides</span>
          <div className="workspace-stage-segmented">
            {guideModes.map((entry) => (
              <button
                key={entry.value}
                className={`workspace-stage-segment ${guideMode === entry.value ? 'active' : ''}`}
                onClick={() => onGuideModeChange?.(entry.value)}
                type="button"
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
        {viewport ? (
          <div className="workspace-stage-pill">
            <span className="workspace-stage-pill__label">Zoom</span>
            <span className="workspace-stage-pill__value">{Math.round(viewport.zoom * 100)}%</span>
          </div>
        ) : null}
        {liveHover ? (
          <div className="workspace-stage-pill">
            <span className="workspace-stage-pill__label">Hover</span>
            <span className="workspace-stage-pill__value">{liveHover.hex} · V{liveHover.value} · {hoverTemperature}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};
