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
  displayMode: DisplayMode;
  guideMode: GuideMode;
  sampleRadius: number;
  visibleLimit: number;
  pinnedHexes: Set<string>;
  viewport: ViewportState | null;
  onViewportChange: (viewport: ViewportState) => void;
  onVisibleColorsChange: (colors: VisibleColorCluster[]) => void;
  onSample: (sample: { point: { x: number; y: number }; hex: string; value: number }) => void;
  onHover: (hover: HoverInfo | null) => void;
};

export const WorkspaceImagePanel = ({
  image,
  displayMode,
  guideMode,
  sampleRadius,
  visibleLimit,
  pinnedHexes,
  viewport,
  onViewportChange,
  onVisibleColorsChange,
  onSample,
  onHover,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [bitmap, setBitmap] = useState<ImageData | null>(null);
  const [dragging, setDragging] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!image?.dataUrl) {
      setBitmap(null);
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
    };
  }, [image, onViewportChange]);

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
          const boosted = Math.pow(l, 0.8);
          const gray = Math.round(Math.min(1, Math.max(0, boosted)) * 255);
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
          const normalized = groups === 9 ? (q - 1) / 8 : q / (groups - 1);
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
    ctx.drawImage(
      scratch,
      viewport.offsetX,
      viewport.offsetY,
      bitmap.width * viewport.zoom,
      bitmap.height * viewport.zoom,
    );

    const bounds = getVisibleImageBounds(viewport);
    const visible = extractVisibleClusters({
      data: bitmap.data,
      width: bitmap.width,
      height: bitmap.height,
      bounds,
      maxColors: visibleLimit,
      minPercent: 0.015,
      pinnedHexes,
    });
    onVisibleColorsChange(visible);
  }, [bitmap, displayMode, viewport, onVisibleColorsChange, visibleLimit, pinnedHexes]);

  const guides = useMemo(() => {
    if (!viewport || guideMode === 'off') return [] as Array<{ x1: number; y1: number; x2: number; y2: number }>;
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    const divisions = guideMode === 'quadrants' ? 2 : guideMode === 'grid-3' ? 3 : 4;

    for (let i = 1; i < divisions; i += 1) {
      const ratio = i / divisions;
      const vStart = imageToScreenPoint({ x: viewport.imageWidth * ratio, y: 0 }, viewport);
      const vEnd = imageToScreenPoint({ x: viewport.imageWidth * ratio, y: viewport.imageHeight }, viewport);
      lines.push({ x1: vStart.x, y1: vStart.y, x2: vEnd.x, y2: vEnd.y });

      const hStart = imageToScreenPoint({ x: 0, y: viewport.imageHeight * ratio }, viewport);
      const hEnd = imageToScreenPoint({ x: viewport.imageWidth, y: viewport.imageHeight * ratio }, viewport);
      lines.push({ x1: hStart.x, y1: hStart.y, x2: hEnd.x, y2: hEnd.y });
    }

    return lines;
  }, [guideMode, viewport]);

  if (!image?.dataUrl) {
    return <div className="paint-reference-empty">Upload a reference image in Prep.</div>;
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
          const next: ViewportState = {
            ...viewport,
            zoom: nextZoom,
            offsetX: point.x - imagePoint.x * nextZoom,
            offsetY: point.y - imagePoint.y * nextZoom,
          };
          onViewportChange(next);
        }}
        onMouseDown={(event) => setDragging({ x: event.clientX, y: event.clientY })}
        onMouseUp={() => setDragging(null)}
        onMouseLeave={() => {
          setDragging(null);
          onHover(null);
        }}
        onMouseMove={(event) => {
          if (!viewport || !bitmap) return;

          if (dragging) {
            const dx = event.clientX - dragging.x;
            const dy = event.clientY - dragging.y;
            setDragging({ x: event.clientX, y: event.clientY });
            onViewportChange({ ...viewport, offsetX: viewport.offsetX + dx, offsetY: viewport.offsetY + dy });
            return;
          }

          const rect = event.currentTarget.getBoundingClientRect();
          const screenPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
          const imagePoint = screenToImagePoint(screenPoint, viewport);
          const rgb = sampleImageAtPoint(bitmap.data, bitmap.width, bitmap.height, imagePoint, sampleRadius);
          const neighborhood = sampleImageAtPoint(bitmap.data, bitmap.width, bitmap.height, imagePoint, sampleRadius + 5);
          const localContrast = Math.round(
            Math.sqrt(
              (rgb.r - neighborhood.r) ** 2 +
                (rgb.g - neighborhood.g) ** 2 +
                (rgb.b - neighborhood.b) ** 2,
            ),
          );
          const luminance = rgbToLuminance(rgb);
          onHover({
            point: { x: Math.round(imagePoint.x), y: Math.round(imagePoint.y) },
            hex: rgbToHex(rgb),
            value: toPainterValue(luminance),
            luminance,
            localContrast,
          });
        }}
        onClick={(event) => {
          if (!viewport || !bitmap) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const screenPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
          const imagePoint = screenToImagePoint(screenPoint, viewport);
          const rgb = sampleImageAtPoint(bitmap.data, bitmap.width, bitmap.height, imagePoint, sampleRadius);
          const luminance = rgbToLuminance(rgb);
          onSample({ point: imagePoint, hex: rgbToHex(rgb), value: toPainterValue(luminance) });
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
              stroke="rgba(255,255,255,0.55)"
              strokeWidth={1}
            />
          ))}
        </svg>
      ) : null}

      <div className="workspace-mode-chip">{displayMode.replace(/-/g, ' ')} · {classifyTemperature('#888888')}</div>
    </div>
  );
};
