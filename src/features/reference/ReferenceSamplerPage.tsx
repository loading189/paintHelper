import { useMemo, useState } from 'react';
import { StudioPanel } from '../../components/studio/StudioPanel';
import { ReferenceSamplerCanvas } from './ReferenceSamplerCanvas';
import { extractPalette } from '../../lib/color/referenceSampler';
import { createTargetFromExtractedColor, createTargetFromSample } from '../../lib/session/workflow';
import type { PaintingSession, ReferenceSample, ReferenceSamplerState } from '../../types/models';
import { createId } from '../../lib/utils/id';

export const ReferenceSamplerPage = ({
  sampler,
  session,
  onSamplerChange,
  onSessionChange,
}: {
  sampler: ReferenceSamplerState;
  session: PaintingSession;
  onSamplerChange: (sampler: ReferenceSamplerState) => void;
  onSessionChange: (session: PaintingSession) => void;
}) => {
  const [hoverHex, setHoverHex] = useState<string | null>(null);
  const [paletteSize, setPaletteSize] = useState(8);

  const selectedSamples = useMemo(() => sampler.samples.filter((sample) => sampler.selectedSampleIds.includes(sample.id)), [sampler.samples, sampler.selectedSampleIds]);

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    onSamplerChange({
      ...sampler,
      image: {
        id: createId('reference-image'),
        name: file.name,
        mimeType: file.type,
        dataUrl,
        addedAt: new Date().toISOString(),
      },
    });
  };

  const addSamplesToSession = (samples: ReferenceSample[]) => {
    onSessionChange({
      ...session,
      updatedAt: new Date().toISOString(),
      targets: [...session.targets, ...samples.map((sample, index) => createTargetFromSample(sample, session.targets.length + index))],
      referenceImageId: sampler.image?.id,
    });
  };

  return (
    <div className="space-y-6">
      <StudioPanel
        tone="strong"
        eyebrow="Reference sampler"
        title="Image-led sampling workstation"
        description="Upload a local reference, inspect edges and transitions with a loupe, sample averaged regions, and push clustered palette candidates into the prep board."
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr),repeat(4,minmax(0,180px))]">
          <label className="studio-upload">
            <span className="studio-eyebrow">Reference image</span>
            <span className="mt-2 block text-base font-semibold text-[color:var(--text-strong)]">{sampler.image?.name ?? 'Upload JPG / PNG / WebP'}</span>
            <input className="mt-4 block w-full text-sm" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleUpload(event.target.files?.[0])} />
          </label>
          <label>
            <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Mode</span>
            <select className="studio-select" value={sampler.sampleMode} onChange={(event) => onSamplerChange({ ...sampler, sampleMode: event.target.value as ReferenceSamplerState['sampleMode'] })}>
              <option value="pixel">Single pixel</option>
              <option value="average">Averaged radius</option>
              <option value="smart">Smart weighted</option>
            </select>
          </label>
          <label>
            <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Radius</span>
            <input className="studio-input" type="number" min={0} max={20} value={sampler.sampleRadius} onChange={(event) => onSamplerChange({ ...sampler, sampleRadius: Number(event.target.value) })} />
          </label>
          <label>
            <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Loupe zoom</span>
            <input className="studio-input" type="number" min={4} max={20} value={sampler.zoom} onChange={(event) => onSamplerChange({ ...sampler, zoom: Number(event.target.value) })} />
          </label>
          <div className="studio-mini-stat h-full"><span>Hover</span><strong>{hoverHex ?? '—'}</strong></div>
        </div>
      </StudioPanel>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.25fr),420px]">
        <StudioPanel title="Sampling canvas" description="Click to create a named sample. Averaged and smart modes read a small region instead of a single pixel.">
          <ReferenceSamplerCanvas
            image={sampler.image}
            sampleMode={sampler.sampleMode}
            radius={sampler.sampleRadius}
            zoom={sampler.zoom}
            onHoverHex={setHoverHex}
            onSample={({ hex, point }) => {
              const sample: ReferenceSample = {
                id: createId('sample'),
                name: `Sample ${sampler.samples.length + 1}`,
                hex,
                point,
                radius: sampler.sampleRadius,
                mode: sampler.sampleMode,
                addedAt: new Date().toISOString(),
              };
              onSamplerChange({ ...sampler, samples: [sample, ...sampler.samples] });
            }}
          />
        </StudioPanel>

        <div className="space-y-6">
          <StudioPanel title="Sample tray" description="Collect manual samples, rename them, and send the selected set directly into the current session.">
            <div className="space-y-3">
              {sampler.samples.length ? sampler.samples.map((sample) => {
                const selected = sampler.selectedSampleIds.includes(sample.id);
                return (
                  <div key={sample.id} className="sample-row">
                    <button type="button" className="sample-swatch" style={{ backgroundColor: sample.hex }} onClick={() => onSamplerChange({
                      ...sampler,
                      selectedSampleIds: selected ? sampler.selectedSampleIds.filter((id) => id !== sample.id) : [...sampler.selectedSampleIds, sample.id],
                    })} />
                    <div className="min-w-0 flex-1">
                      <input className="studio-input" value={sample.name} onChange={(event) => onSamplerChange({
                        ...sampler,
                        samples: sampler.samples.map((candidate) => candidate.id === sample.id ? { ...candidate, name: event.target.value } : candidate),
                      })} />
                      <p className="mt-2 text-sm text-[color:var(--text-muted)]">{sample.hex} · {sample.mode} · radius {sample.radius}</p>
                    </div>
                  </div>
                );
              }) : <div className="studio-empty-state">Sample colors from the canvas to fill the tray.</div>}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="studio-button studio-button-primary" type="button" onClick={() => addSamplesToSession(selectedSamples.length ? selectedSamples : sampler.samples)} disabled={!sampler.samples.length}>Send to prep board</button>
              <button className="studio-button studio-button-secondary" type="button" onClick={() => onSamplerChange({ ...sampler, samples: [], selectedSampleIds: [] })}>Clear tray</button>
            </div>
          </StudioPanel>

          <StudioPanel title="Auto palette extraction" description="Deterministic in-browser clustering for grouped palette candidates.">
            <div className="flex flex-wrap gap-3">
              {[5, 8, 12].map((count) => (
                <button key={count} className={`studio-button ${paletteSize === count ? 'studio-button-primary' : 'studio-button-secondary'}`} type="button" onClick={() => setPaletteSize(count)}>{count} colors</button>
              ))}
              <button
                className="studio-button studio-button-secondary"
                type="button"
                onClick={() => {
                  if (!sampler.image?.dataUrl || typeof document === 'undefined') return;
                  const image = new Image();
                  image.src = sampler.image.dataUrl;
                  image.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = image.width;
                    canvas.height = image.height;
                    const context = canvas.getContext('2d');
                    if (!context) return;
                    context.drawImage(image, 0, 0);
                    const data = context.getImageData(0, 0, canvas.width, canvas.height);
                    onSamplerChange({
                      ...sampler,
                      extractedPalette: extractPalette({ width: canvas.width, height: canvas.height, data: data.data }, paletteSize),
                    });
                  };
                }}
                disabled={!sampler.image?.dataUrl}
              >
                Extract palette
              </button>
            </div>
            <div className="extracted-grid mt-5">
              {sampler.extractedPalette.length ? sampler.extractedPalette.map((color, index) => (
                <button
                  key={color.id}
                  type="button"
                  className="extracted-card"
                  onClick={() => onSessionChange({
                    ...session,
                    updatedAt: new Date().toISOString(),
                    targets: [...session.targets, createTargetFromExtractedColor(color.hex, color.label, session.targets.length + index)],
                  })}
                >
                  <div className="extracted-swatch" style={{ backgroundColor: color.hex }} />
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--text-strong)]">{color.label}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[color:var(--text-muted)]">{color.hex} · {color.population}</p>
                  </div>
                </button>
              )) : <div className="studio-empty-state">Run palette extraction to surface grouped color candidates.</div>}
            </div>
          </StudioPanel>
        </div>
      </div>
    </div>
  );
};
