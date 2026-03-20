import { useEffect, useMemo, useRef, useState } from 'react';
import { rgbToHex } from '../../lib/color/colorMath';
import { sampleImageColor, type ImageBitmapLike } from '../../lib/color/referenceSampler';
import type { ReferenceImageMeta, SampleMode } from '../../types/models';

const LOUPE_SIZE = 108;

export const ReferenceSamplerCanvas = ({
  image,
  sampleMode,
  radius,
  zoom,
  onHoverHex,
  onSample,
}: {
  image?: ReferenceImageMeta;
  sampleMode: SampleMode;
  radius: number;
  zoom: number;
  onHoverHex?: (hex: string | null) => void;
  onSample: (sample: { hex: string; point: { x: number; y: number } }) => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loupeRef = useRef<HTMLCanvasElement | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmapLike | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let revoked: string | undefined;
    if (!image?.dataUrl || typeof window === 'undefined') {
      setBitmap(null);
      return;
    }

    const htmlImage = new Image();
    htmlImage.src = image.dataUrl;
    revoked = image.objectUrl;
    htmlImage.onload = () => {
      const scratch = document.createElement('canvas');
      scratch.width = htmlImage.width;
      scratch.height = htmlImage.height;
      const context = scratch.getContext('2d');
      if (!context) return;
      context.drawImage(htmlImage, 0, 0);
      const imageData = context.getImageData(0, 0, scratch.width, scratch.height);
      setBitmap({ width: scratch.width, height: scratch.height, data: imageData.data });
    };

    return () => {
      if (revoked) {
        URL.revokeObjectURL(revoked);
      }
    };
  }, [image]);

  useEffect(() => {
    if (!bitmap || !canvasRef.current || typeof window === 'undefined') {
      return;
    }
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const imageData = new ImageData(new Uint8ClampedArray(bitmap.data), bitmap.width, bitmap.height);
    context.putImageData(imageData, 0, 0);
  }, [bitmap]);

  const drawLoupe = (point: { x: number; y: number } | null) => {
    if (!bitmap || !loupeRef.current) {
      return;
    }
    const loupe = loupeRef.current;
    const context = loupe.getContext('2d');
    if (!context) return;

    loupe.width = LOUPE_SIZE;
    loupe.height = LOUPE_SIZE;
    context.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
    context.fillStyle = '#0f1216';
    context.fillRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);

    if (!point) {
      return;
    }

    const half = Math.floor(LOUPE_SIZE / (2 * zoom));
    const startX = Math.max(0, Math.min(bitmap.width - 1, point.x - half));
    const startY = Math.max(0, Math.min(bitmap.height - 1, point.y - half));
    const scratch = document.createElement('canvas');
    scratch.width = bitmap.width;
    scratch.height = bitmap.height;
    const scratchContext = scratch.getContext('2d');
    if (!scratchContext) return;
    scratchContext.putImageData(new ImageData(new Uint8ClampedArray(bitmap.data), bitmap.width, bitmap.height), 0, 0);
    context.imageSmoothingEnabled = false;
    context.drawImage(scratch, startX, startY, half * 2, half * 2, 0, 0, LOUPE_SIZE, LOUPE_SIZE);
    context.strokeStyle = 'rgba(255,255,255,0.85)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(LOUPE_SIZE / 2, 0);
    context.lineTo(LOUPE_SIZE / 2, LOUPE_SIZE);
    context.moveTo(0, LOUPE_SIZE / 2);
    context.lineTo(LOUPE_SIZE, LOUPE_SIZE / 2);
    context.stroke();
  };

  useEffect(() => {
    drawLoupe(hover);
  }, [hover, bitmap, zoom]);

  const currentHoverHex = useMemo(() => {
    if (!bitmap || !hover) return null;
    const rgb = sampleImageColor(bitmap, hover, radius, sampleMode);
    return rgbToHex(rgb);
  }, [bitmap, hover, radius, sampleMode]);

  useEffect(() => {
    onHoverHex?.(currentHoverHex);
  }, [currentHoverHex, onHoverHex]);

  if (!image?.dataUrl) {
    return <div className="sampler-empty">Upload a JPG, PNG, or WebP reference to begin sampling.</div>;
  }

  return (
    <div className="sampler-canvas-shell">
      <div className="sampler-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="sampler-canvas"
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const x = Math.round(((event.clientX - rect.left) / rect.width) * (bitmap?.width ?? 1));
            const y = Math.round(((event.clientY - rect.top) / rect.height) * (bitmap?.height ?? 1));
            setHover({ x, y });
          }}
          onMouseLeave={() => {
            setHover(null);
            onHoverHex?.(null);
          }}
          onClick={() => {
            if (!bitmap || !hover) return;
            const rgb = sampleImageColor(bitmap, hover, radius, sampleMode);
            onSample({ hex: rgbToHex(rgb), point: hover });
          }}
        />
      </div>
      <div className="loupe-panel">
        <p className="studio-eyebrow">Precision loupe</p>
        <canvas ref={loupeRef} className="sampler-loupe mt-3" />
        <p className="mt-3 text-sm text-[color:var(--text-muted)]">{currentHoverHex ?? 'Hover to inspect a region'}</p>
      </div>
    </div>
  );
};
