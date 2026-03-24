import { createId } from '../../lib/utils/id';

export type ViewportState = {
  zoom: number;
  offsetX: number;
  offsetY: number;
  containerWidth: number;
  containerHeight: number;
  imageWidth: number;
  imageHeight: number;
};

export type ImagePoint = { x: number; y: number };
export type Bounds = { x: number; y: number; width: number; height: number };
export type Rgb = { r: number; g: number; b: number };

export type DisplayMode =
  | 'color'
  | 'grayscale'
  | 'high-contrast-grayscale'
  | 'muted'
  | 'value-3'
  | 'value-5'
  | 'value-9'
  | 'edge-map';

export type GuideMode = 'off' | 'quadrants' | 'grid-3' | 'grid-4';

export type VisibleColorCluster = {
  id: string;
  hex: string;
  count: number;
  percent: number;
  value: number;
  pinned: boolean;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const toPainterValue = (luminance: number): number => {
  const normalized = clamp(luminance, 0, 1);
  return clamp(Math.round(9 - normalized * 8), 1, 9);
};

export const rgbToLuminance = (rgb: Rgb): number =>
  clamp((0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255, 0, 1);

export const rgbToHex = (rgb: Rgb): string =>
  `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g
    .toString(16)
    .padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`.toUpperCase();

export const hexToRgb = (hex: string): Rgb => {
  const normalized = hex.replace('#', '').trim();
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized;

  return {
    r: parseInt(expanded.slice(0, 2), 16) || 0,
    g: parseInt(expanded.slice(2, 4), 16) || 0,
    b: parseInt(expanded.slice(4, 6), 16) || 0,
  };
};

export const fitViewport = (
  imageWidth: number,
  imageHeight: number,
  containerWidth: number,
  containerHeight: number,
): ViewportState => {
  const scaleX = containerWidth / imageWidth;
  const scaleY = containerHeight / imageHeight;
  const zoom = Math.min(scaleX, scaleY);
  const renderedWidth = imageWidth * zoom;
  const renderedHeight = imageHeight * zoom;

  return {
    zoom,
    offsetX: (containerWidth - renderedWidth) / 2,
    offsetY: (containerHeight - renderedHeight) / 2,
    containerWidth,
    containerHeight,
    imageWidth,
    imageHeight,
  };
};

export const getVisibleImageBounds = (viewport: ViewportState): Bounds => {
  const left = clamp(-viewport.offsetX / viewport.zoom, 0, viewport.imageWidth);
  const top = clamp(-viewport.offsetY / viewport.zoom, 0, viewport.imageHeight);
  const right = clamp(
    (viewport.containerWidth - viewport.offsetX) / viewport.zoom,
    0,
    viewport.imageWidth,
  );
  const bottom = clamp(
    (viewport.containerHeight - viewport.offsetY) / viewport.zoom,
    0,
    viewport.imageHeight,
  );

  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
};

export const imageToScreenPoint = (point: ImagePoint, viewport: ViewportState): ImagePoint => ({
  x: viewport.offsetX + point.x * viewport.zoom,
  y: viewport.offsetY + point.y * viewport.zoom,
});

export const screenToImagePoint = (point: ImagePoint, viewport: ViewportState): ImagePoint => ({
  x: clamp((point.x - viewport.offsetX) / viewport.zoom, 0, viewport.imageWidth - 1),
  y: clamp((point.y - viewport.offsetY) / viewport.zoom, 0, viewport.imageHeight - 1),
});

export const sampleImageAtPoint = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  point: ImagePoint,
  radius: number,
): Rgb => {
  const r = Math.max(0, Math.floor(radius));
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let count = 0;

  const cx = Math.round(point.x);
  const cy = Math.round(point.y);

  for (let y = cy - r; y <= cy + r; y += 1) {
    if (y < 0 || y >= height) continue;
    for (let x = cx - r; x <= cx + r; x += 1) {
      if (x < 0 || x >= width) continue;
      const idx = (y * width + x) * 4;
      totalR += data[idx];
      totalG += data[idx + 1];
      totalB += data[idx + 2];
      count += 1;
    }
  }

  if (!count) {
    return { r: 0, g: 0, b: 0 };
  }

  return {
    r: Math.round(totalR / count),
    g: Math.round(totalG / count),
    b: Math.round(totalB / count),
  };
};

const quantizeStep = 16;

const quantize = (rgb: Rgb): Rgb => ({
  r: Math.round(rgb.r / quantizeStep) * quantizeStep,
  g: Math.round(rgb.g / quantizeStep) * quantizeStep,
  b: Math.round(rgb.b / quantizeStep) * quantizeStep,
});

const colorDistance = (a: Rgb, b: Rgb): number => {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

export const extractVisibleClusters = ({
  data,
  width,
  height,
  bounds,
  maxColors,
  minPercent,
  pinnedHexes,
}: {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  bounds: Bounds;
  maxColors: number;
  minPercent: number;
  pinnedHexes: Set<string>;
}): VisibleColorCluster[] => {
  const map = new Map<string, { rgb: Rgb; count: number }>();
  const startX = Math.floor(bounds.x);
  const startY = Math.floor(bounds.y);
  const endX = Math.min(width, Math.ceil(bounds.x + bounds.width));
  const endY = Math.min(height, Math.ceil(bounds.y + bounds.height));
  const step = Math.max(1, Math.floor(Math.max(bounds.width, bounds.height) / 120));

  let total = 0;

  for (let y = startY; y < endY; y += step) {
    for (let x = startX; x < endX; x += step) {
      const idx = (y * width + x) * 4;
      const raw = { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
      const q = quantize(raw);
      const key = `${q.r},${q.g},${q.b}`;
      const current = map.get(key);
      if (current) {
        current.count += 1;
      } else {
        map.set(key, { rgb: q, count: 1 });
      }
      total += 1;
    }
  }

  const merged = Array.from(map.values()).sort((a, b) => b.count - a.count);
  const deduped: Array<{ rgb: Rgb; count: number }> = [];

  merged.forEach((entry) => {
    const existing = deduped.find((cluster) => colorDistance(cluster.rgb, entry.rgb) < 22);
    if (existing) {
      existing.count += entry.count;
      existing.rgb = {
        r: Math.round((existing.rgb.r + entry.rgb.r) / 2),
        g: Math.round((existing.rgb.g + entry.rgb.g) / 2),
        b: Math.round((existing.rgb.b + entry.rgb.b) / 2),
      };
      return;
    }
    deduped.push({ ...entry });
  });

  return deduped
    .map((entry) => {
      const percent = total > 0 ? entry.count / total : 0;
      const hex = rgbToHex(entry.rgb);
      return {
        id: hex,
        hex,
        count: entry.count,
        percent,
        value: toPainterValue(rgbToLuminance(entry.rgb)),
        pinned: pinnedHexes.has(hex),
      };
    })
    .filter((entry) => entry.percent >= minPercent || entry.pinned)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (b.percent !== a.percent) return b.percent - a.percent;
      return a.hex.localeCompare(b.hex);
    })
    .slice(0, maxColors)
    .map((entry) => ({
      ...entry,
      id: createId(`visible-color-${entry.hex.replace('#', '')}`),
    }));
};

export const classifyTemperature = (hex: string): 'warm' | 'neutral' | 'cool' => {
  const rgb = hexToRgb(hex);
  const warmScore = rgb.r - rgb.b;
  if (warmScore > 22) return 'warm';
  if (warmScore < -22) return 'cool';
  return 'neutral';
};

export const nearestColor = (
  targetHex: string,
  candidates: Array<{ id: string; hex: string; label: string; sectionName?: string }>,
) => {
  const target = hexToRgb(targetHex);
  const ranked = candidates
    .map((candidate) => {
      const rgb = hexToRgb(candidate.hex);
      return {
        ...candidate,
        distance: colorDistance(target, rgb),
      };
    })
    .sort((a, b) => a.distance - b.distance || a.label.localeCompare(b.label));

  return ranked[0] ?? null;
};

export const quantizeValueGrouping = (luminance: number, groups: 3 | 5 | 9): number => {
  const clamped = clamp(luminance, 0, 1);

  if (groups === 9) {
    return toPainterValue(clamped);
  }

  const darkness = 1 - clamped;
  const index = Math.round(darkness * (groups - 1));
  return clamp(index, 0, groups - 1);
};