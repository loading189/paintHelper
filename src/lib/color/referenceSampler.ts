import type { ExtractedPaletteColor, RgbColor, SampleMode } from '../../types/models';
import { analyzeColor } from './colorAnalysis';
import { normalizeHex, rgbToHex } from './colorMath';

const clampChannel = (value: number): number => Math.max(0, Math.min(255, value));

export type PixelPoint = { x: number; y: number };
export type ImageBitmapLike = { width: number; height: number; data: Uint8ClampedArray };

type Cluster = { centroid: [number, number, number]; pixels: number[][] };

const weightedFactor = (distance: number, radius: number): number => Math.max(0.05, 1 - distance / Math.max(1, radius + 1));

const getIndex = (width: number, x: number, y: number): number => (y * width + x) * 4;

export const sampleImageColor = (
  image: ImageBitmapLike,
  point: PixelPoint,
  radius: number,
  mode: SampleMode,
): RgbColor => {
  const centerX = Math.max(0, Math.min(image.width - 1, Math.round(point.x)));
  const centerY = Math.max(0, Math.min(image.height - 1, Math.round(point.y)));

  if (radius <= 0 || mode === 'pixel') {
    const index = getIndex(image.width, centerX, centerY);
    return {
      r: image.data[index],
      g: image.data[index + 1],
      b: image.data[index + 2],
    };
  }

  let totalWeight = 0;
  let r = 0;
  let g = 0;
  let b = 0;

  for (let y = Math.max(0, centerY - radius); y <= Math.min(image.height - 1, centerY + radius); y += 1) {
    for (let x = Math.max(0, centerX - radius); x <= Math.min(image.width - 1, centerX + radius); x += 1) {
      const dx = x - centerX;
      const dy = y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > radius) {
        continue;
      }
      const weight = mode === 'smart' ? weightedFactor(distance, radius) : 1;
      const index = getIndex(image.width, x, y);
      r += image.data[index] * weight;
      g += image.data[index + 1] * weight;
      b += image.data[index + 2] * weight;
      totalWeight += weight;
    }
  }

  return {
    r: clampChannel(Math.round(r / Math.max(1, totalWeight))),
    g: clampChannel(Math.round(g / Math.max(1, totalWeight))),
    b: clampChannel(Math.round(b / Math.max(1, totalWeight))),
  };
};

const distanceSq = (left: number[], right: number[]): number => {
  const dr = left[0] - right[0];
  const dg = left[1] - right[1];
  const db = left[2] - right[2];
  return dr * dr + dg * dg + db * db;
};

const buildDeterministicSeeds = (pixels: number[][], k: number): number[][] => {
  const sorted = [...pixels].sort((a, b) => {
    const l = a[0] + a[1] + a[2];
    const r = b[0] + b[1] + b[2];
    return l - r || a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  });

  return Array.from({ length: k }, (_, index) => {
    const position = Math.min(sorted.length - 1, Math.floor((index / Math.max(1, k - 1 || 1)) * (sorted.length - 1)));
    return [...sorted[position]];
  });
};

const rebalanceClusters = (clusters: Cluster[]): Cluster[] =>
  clusters.map((cluster) => {
    if (cluster.pixels.length === 0) {
      return cluster;
    }

    const sums = cluster.pixels.reduce(
      (accumulator, pixel) => {
        accumulator[0] += pixel[0];
        accumulator[1] += pixel[1];
        accumulator[2] += pixel[2];
        return accumulator;
      },
      [0, 0, 0],
    );

    return {
      centroid: [
        sums[0] / cluster.pixels.length,
        sums[1] / cluster.pixels.length,
        sums[2] / cluster.pixels.length,
      ],
      pixels: cluster.pixels,
    };
  });

export const extractPalette = (image: ImageBitmapLike, paletteSize: number): ExtractedPaletteColor[] => {
  const step = Math.max(1, Math.floor(Math.max(image.width, image.height) / 72));
  const pixels: number[][] = [];

  for (let y = 0; y < image.height; y += step) {
    for (let x = 0; x < image.width; x += step) {
      const index = getIndex(image.width, x, y);
      pixels.push([image.data[index], image.data[index + 1], image.data[index + 2]]);
    }
  }

  if (pixels.length === 0) {
    return [];
  }

  const k = Math.min(Math.max(1, paletteSize), pixels.length);
  let centroids = buildDeterministicSeeds(pixels, k);

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const clusters: Cluster[] = centroids.map((centroid) => ({ centroid: [centroid[0], centroid[1], centroid[2]], pixels: [] }));

    pixels.forEach((pixel) => {
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      centroids.forEach((centroid, index) => {
        const distance = distanceSq(pixel, centroid);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });
      clusters[bestIndex].pixels.push(pixel);
    });

    const rebalanced = rebalanceClusters(clusters);
    centroids = rebalanced.map((cluster) => cluster.centroid);
  }

  const finalClusters: Cluster[] = centroids.map((centroid) => ({ centroid: [centroid[0], centroid[1], centroid[2]], pixels: [] }));
  pixels.forEach((pixel) => {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    centroids.forEach((centroid, index) => {
      const distance = distanceSq(pixel, centroid);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    finalClusters[bestIndex].pixels.push(pixel);
  });

  const deduped = finalClusters
    .filter((cluster) => cluster.pixels.length > 0)
    .map((cluster, index) => {
      const rgb = {
        r: clampChannel(Math.round(cluster.centroid[0])),
        g: clampChannel(Math.round(cluster.centroid[1])),
        b: clampChannel(Math.round(cluster.centroid[2])),
      };
      const hex = normalizeHex(rgbToHex(rgb)) ?? '#000000';
      const analysis = analyzeColor(hex);
      const label = analysis ? `${analysis.hueFamily} ${analysis.valueClassification}` : `Cluster ${index + 1}`;
      return {
        id: `palette-${index}-${hex.slice(1)}`,
        hex,
        population: cluster.pixels.length,
        label,
      } satisfies ExtractedPaletteColor;
    })
    .sort((left, right) => right.population - left.population || left.hex.localeCompare(right.hex));

  return deduped.filter((color, index, array) => array.findIndex((candidate) => candidate.hex === color.hex) === index).slice(0, paletteSize);
};
