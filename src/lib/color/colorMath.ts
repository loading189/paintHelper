import type { LinearRgbColor, RgbColor } from '../../types/models';

const HEX_PATTERN = /^#?([a-f\d]{6})$/i;

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
  const channels = [r, g, b].map((channel) => Math.max(0, Math.min(255, Math.round(channel))));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
};

export const srgbChannelToLinear = (channel: number): number => {
  if (channel <= 0.04045) {
    return channel / 12.92;
  }

  return ((channel + 0.055) / 1.055) ** 2.4;
};

export const linearChannelToSrgb = (channel: number): number => {
  if (channel <= 0.0031308) {
    return channel * 12.92;
  }

  return 1.055 * (channel ** (1 / 2.4)) - 0.055;
};

export const srgbRgbToLinearRgb = ({ r, g, b }: RgbColor): LinearRgbColor => ({
  r: srgbChannelToLinear(r / 255),
  g: srgbChannelToLinear(g / 255),
  b: srgbChannelToLinear(b / 255),
});

export const linearRgbToSrgbRgb = ({ r, g, b }: LinearRgbColor): RgbColor => ({
  r: Math.round(Math.max(0, Math.min(1, linearChannelToSrgb(r))) * 255),
  g: Math.round(Math.max(0, Math.min(1, linearChannelToSrgb(g))) * 255),
  b: Math.round(Math.max(0, Math.min(1, linearChannelToSrgb(b))) * 255),
});

export const colorDistance = (left: LinearRgbColor, right: LinearRgbColor): number => {
  const dr = left.r - right.r;
  const dg = left.g - right.g;
  const db = left.b - right.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
};
