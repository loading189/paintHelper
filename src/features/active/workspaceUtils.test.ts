import { describe, expect, it } from 'vitest';
import {
  fitViewport,
  getVisibleImageBounds,
  isNearHex,
  nearestColor,
  quantizeValueGrouping,
  sampleImageAtPoint,
  screenToImagePoint,
  toPainterValue,
} from './workspaceUtils';

describe('workspace utils', () => {
  it('maps luminance to painter value (1 white, 9 black)', () => {
    expect(toPainterValue(0)).toBe(9);
    expect(toPainterValue(1)).toBe(1);
    expect(toPainterValue(0.5)).toBe(5);
  });

  it('computes stable visible bounds from viewport', () => {
    const viewport = fitViewport(1000, 500, 500, 500);
    const bounds = getVisibleImageBounds(viewport);
    expect(bounds.width).toBeCloseTo(1000, 2);
    expect(bounds.height).toBeCloseTo(500, 2);
  });

  it('converts screen point to image point deterministically', () => {
    const viewport = {
      zoom: 2,
      offsetX: 10,
      offsetY: 20,
      containerWidth: 400,
      containerHeight: 400,
      imageWidth: 100,
      imageHeight: 100,
    };
    const point = screenToImagePoint({ x: 110, y: 120 }, viewport);
    expect(point).toEqual({ x: 50, y: 50 });
  });

  it('averages local sample region', () => {
    const data = new Uint8ClampedArray([
      10, 20, 30, 255,
      30, 40, 50, 255,
      50, 60, 70, 255,
      70, 80, 90, 255,
    ]);
    const sampled = sampleImageAtPoint(data, 2, 2, { x: 0, y: 0 }, 1);
    expect(sampled).toEqual({ r: 40, g: 50, b: 60 });
  });

  it('quantizes value groups', () => {
    expect(quantizeValueGrouping(0, 3)).toBe(0);
    expect(quantizeValueGrouping(1, 5)).toBe(4);
    expect(quantizeValueGrouping(1, 9)).toBe(9);
  });

  it('finds deterministic nearest palette match', () => {
    const match = nearestColor('#808080', [
      { id: 'a', hex: '#101010', label: 'Dark' },
      { id: 'b', hex: '#7F7F7F', label: 'Near gray' },
    ]);
    expect(match?.id).toBe('b');
  });

  it('supports near-color duplicate guards for used tray', () => {
    expect(isNearHex('#101010', '#121212', 6)).toBe(true);
    expect(isNearHex('#101010', '#555555', 6)).toBe(false);
  });
});
