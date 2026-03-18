import type { LinearRgbColor, RgbColor } from '../../types/models';

const HEX_PATTERN = /^#?([a-f\d]{6})$/i;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const clamp255 = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));

export const normalizeHex = (hex: string): string | null => {
  const trimmed = hex.trim();
  const matched = trimmed.match(HEX_PATTERN);

  if (!matched) {
    return null;
  }

  return `#${matched[1].toUpperCase()}`;
};

export const hexToRgb = (hex: string): RgbColor | null => {
  const normalized = normalizeHex(hex);
  if (!normalized) {
    return null;
  }

  const value = normalized.slice(1);

  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
};

export const rgbToHex = ({ r, g, b }: RgbColor): string => {
  return `#${[r, g, b]
    .map(clamp255)
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
};

export const srgbChannelToLinear = (channel: number): number => {
  const clamped = clamp01(channel);

  if (clamped <= 0.04045) {
    return clamped / 12.92;
  }

  return ((clamped + 0.055) / 1.055) ** 2.4;
};

export const linearChannelToSrgb = (channel: number): number => {
  const clamped = clamp01(channel);

  if (clamped <= 0.0031308) {
    return clamped * 12.92;
  }

  return 1.055 * (clamped ** (1 / 2.4)) - 0.055;
};

export const srgbRgbToLinearRgb = ({ r, g, b }: RgbColor): LinearRgbColor => ({
  r: srgbChannelToLinear(r / 255),
  g: srgbChannelToLinear(g / 255),
  b: srgbChannelToLinear(b / 255),
});

export const linearRgbToSrgbRgb = ({ r, g, b }: LinearRgbColor): RgbColor => ({
  r: clamp255(linearChannelToSrgb(r) * 255),
  g: clamp255(linearChannelToSrgb(g) * 255),
  b: clamp255(linearChannelToSrgb(b) * 255),
});

export const hexToLinearRgb = (hex: string): LinearRgbColor | null => {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return null;
  }

  return srgbRgbToLinearRgb(rgb);
};

export const linearRgbToHex = (color: LinearRgbColor): string => {
  return rgbToHex(linearRgbToSrgbRgb(color));
};

export const blendLinearRgb = (
  colors: Array<{ color: LinearRgbColor; weight: number }>,
): LinearRgbColor => {
  if (!colors.length) {
    return { r: 0, g: 0, b: 0 };
  }

  const totalWeight = colors.reduce((sum, item) => sum + item.weight, 0);

  if (totalWeight <= 0) {
    return { r: 0, g: 0, b: 0 };
  }

  const blended = colors.reduce(
    (acc, item) => {
      const normalizedWeight = item.weight / totalWeight;
      acc.r += item.color.r * normalizedWeight;
      acc.g += item.color.g * normalizedWeight;
      acc.b += item.color.b * normalizedWeight;
      return acc;
    },
    { r: 0, g: 0, b: 0 },
  );

  return {
    r: clamp01(blended.r),
    g: clamp01(blended.g),
    b: clamp01(blended.b),
  };
};

export const colorDistance = (left: LinearRgbColor, right: LinearRgbColor): number => {
  const dr = left.r - right.r;
  const dg = left.g - right.g;
  const db = left.b - right.b;

  return Math.sqrt(dr * dr + dg * dg + db * db);
};