import { useMemo, useState } from 'react';
import { Card } from '../../components/Card';
import { createId } from '../../lib/utils/id';
import { solveColorTarget } from '../../lib/color/solvePipeline';
import type {
  MixStatus,
  Paint,
  PaintingSession,
  RankedRecipe,
  UserSettings,
} from '../../types/models';
import { WorkspaceImagePanel } from './WorkspaceImagePanel';
import {
  classifyTemperature,
  fitViewport,
  nearestColor,
  toPainterValue,
  type DisplayMode,
  type GuideMode,
  type ViewportState,
  type VisibleColorCluster,
} from './workspaceUtils';

const mixStatuses: Array<{ value: MixStatus; label: string }> = [
  { value: 'not-mixed', label: 'Not mixed' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'adjusted', label: 'Adjusted' },
  { value: 'remix-needed', label: 'Remix needed' },
];

type WorkingColorStatus = 'not-mixed' | 'predicted' | 'mixed' | 'adjusted' | 'approved';
type SourceType = 'visible-cluster' | 'manual-sample' | 'imported-target';

type AdjustmentTag = 'warmer' | 'cooler' | 'lighter' | 'darker' | 'more-chroma' | 'less-chroma';

type WorkingColor = {
  id: string;
  sectionId: string;
  label: string;
  sourceType: SourceType;
  targetHex: string;
  value: number;
  notes?: string;
  status: WorkingColorStatus;
  pinned: boolean;
  predictedRecipe?: RankedRecipe;
  actualHex?: string;
  comparisonNote?: string;
  adjustmentLog: Array<{ id: string; note: string; tags: AdjustmentTag[]; createdAt: string }>;
};

type Section = {
  id: string;
  name: string;
  description?: string;
  viewportSnapshot?: { x: number; y: number; zoom: number };
};

type ActivePaintingPageProps = {
  session: PaintingSession | null;
  paints: Paint[];
  settings: UserSettings;
  onSessionChange: (session: PaintingSession) => void;
  onReopenInPrep: () => void;
};

const defaultSection = (): Section => ({ id: createId('section'), name: 'Main section' });

export const ActivePaintingPage = ({
  session,
  paints,
  settings,
  onSessionChange,
  onReopenInPrep,
}: ActivePaintingPageProps) => {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('color');
  const [guideMode, setGuideMode] = useState<GuideMode>('off');
  const [sampleRadius, setSampleRadius] = useState(2);
  const [visibleLimit, setVisibleLimit] = useState(8);
  const [visibleColors, setVisibleColors] = useState<VisibleColorCluster[]>([]);
  const [hoverInfo, setHoverInfo] = useState<{
    point: { x: number; y: number };
    hex: string;
    value: number;
    luminance: number;
    localContrast: number;
  } | null>(null);
  const [viewport, setViewport] = useState<ViewportState | null>(null);
  const [sections, setSections] = useState<Section[]>([defaultSection()]);
  const [activeSectionId, setActiveSectionId] = useState<string>(sections[0].id);
  const [workingColors, setWorkingColors] = useState<WorkingColor[]>([]);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [paletteView, setPaletteView] = useState<'active' | 'all'>('active');
  const [pinnedVisibleHexes, setPinnedVisibleHexes] = useState<Set<string>>(new Set());

  if (!session) {
    return (
      <Card className="p-6 sm:p-7">
        <div className="space-y-3">
          <p className="studio-kicker">Paint</p>
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-strong)]">No project selected</h2>
          <p className="text-sm text-[color:var(--text-muted)]">Open a project in Prep first.</p>
        </div>
      </Card>
    );
  }

  const selectedColor = selectedColorId ? workingColors.find((c) => c.id === selectedColorId) ?? null : null;
  const colorsInView = workingColors.filter((color) => (paletteView === 'all' ? true : color.sectionId === activeSectionId));
  const nearest = selectedColor
    ? nearestColor(
        selectedColor.targetHex,
        workingColors
          .filter((color) => color.id !== selectedColor.id)
          .map((color) => ({
            id: color.id,
            hex: color.targetHex,
            label: color.label,
            sectionName: sections.find((section) => section.id === color.sectionId)?.name,
          })),
      )
    : null;

  const addWorkingColor = (input: { hex: string; value: number; sourceType: SourceType; label?: string }) => {
    const color: WorkingColor = {
      id: createId('work-color'),
      sectionId: activeSectionId,
      label: input.label ?? `Color ${workingColors.length + 1}`,
      sourceType: input.sourceType,
      targetHex: input.hex,
      value: input.value,
      status: 'not-mixed',
      pinned: false,
      adjustmentLog: [],
    };
    setWorkingColors((prev) => [color, ...prev]);
    setSelectedColorId(color.id);
  };

  const solveForColor = (color: WorkingColor) => {
    const result = solveColorTarget(color.targetHex, paints, settings, 3);
    const top = result.rankedRecipes[0];
    if (!top) return;

    setWorkingColors((prev) =>
      prev.map((item) =>
        item.id === color.id
          ? {
              ...item,
              predictedRecipe: top,
              status: 'predicted',
            }
          : item,
      ),
    );
  };

  return (
    <div className="paint-workspace-helper">
      <section className="paint-workspace-helper-main">
        <Card className="p-4 sm:p-5 paint-reference-card">
          <div className="paint-reference-topline">
            <div>
              <p className="studio-kicker">Painting helper workspace</p>
              <h2 className="paint-hero-title">Deterministic section-based image analysis and mixing</h2>
            </div>
            <div className="paint-reference-meta">
              <button className="studio-button studio-button-secondary" onClick={onReopenInPrep}>Open Prep</button>
              <button
                className="studio-button studio-button-secondary"
                onClick={() => {
                  if (!session.referenceImage || !viewport) return;
                  setViewport(
                    fitViewport(
                      viewport.imageWidth,
                      viewport.imageHeight,
                      viewport.containerWidth,
                      viewport.containerHeight,
                    ),
                  );
                }}
              >
                Fit
              </button>
            </div>
          </div>

          <div className="workspace-controls-row">
            <label>View</label>
            <select value={displayMode} onChange={(e) => setDisplayMode(e.target.value as DisplayMode)}>
              <option value="color">Full color</option>
              <option value="grayscale">Grayscale</option>
              <option value="high-contrast-grayscale">High contrast grayscale</option>
              <option value="muted">Muted saturation</option>
              <option value="value-3">Value grouping (3)</option>
              <option value="value-5">Value grouping (5)</option>
              <option value="value-9">Value grouping (9)</option>
              <option value="edge-map">Edge/contrast map</option>
            </select>

            <label>Guides</label>
            <select value={guideMode} onChange={(e) => setGuideMode(e.target.value as GuideMode)}>
              <option value="off">Off</option>
              <option value="quadrants">Quadrants</option>
              <option value="grid-3">3x3</option>
              <option value="grid-4">4x4</option>
            </select>

            <label>Sample radius</label>
            <input type="number" min={0} max={8} value={sampleRadius} onChange={(e) => setSampleRadius(Number(e.target.value))} />
          </div>

          <div className="paint-reference-stage paint-reference-stage-workspace">
            <WorkspaceImagePanel
              image={session.referenceImage}
              displayMode={displayMode}
              guideMode={guideMode}
              sampleRadius={sampleRadius}
              visibleLimit={visibleLimit}
              pinnedHexes={pinnedVisibleHexes}
              viewport={viewport}
              onViewportChange={setViewport}
              onVisibleColorsChange={setVisibleColors}
              onHover={setHoverInfo}
              onSample={({ hex, point, value }) => {
                addWorkingColor({ hex, value, sourceType: 'manual-sample', label: `Sample (${Math.round(point.x)}, ${Math.round(point.y)})` });
              }}
            />
          </div>
        </Card>
      </section>

      <aside className="paint-workspace-helper-rail">
        <Card className="p-4">
          <p className="studio-kicker">Hover inspector</p>
          {hoverInfo ? (
            <div className="space-y-2 mt-2">
              <div className="workspace-row"><span className="workspace-dot" style={{ backgroundColor: hoverInfo.hex }} />{hoverInfo.hex}</div>
              <p>Value: {hoverInfo.value} (1 white · 9 black)</p>
              <p>Luminance: {hoverInfo.luminance.toFixed(3)}</p>
              <p>Local contrast: {hoverInfo.localContrast}</p>
              <p>xy: {hoverInfo.point.x}, {hoverInfo.point.y}</p>
            </div>
          ) : <p className="text-sm text-[color:var(--text-muted)]">Move over the image to inspect.</p>}
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="studio-kicker">Visible viewport colors</p>
            <input type="number" min={4} max={12} value={visibleLimit} onChange={(e) => setVisibleLimit(Number(e.target.value))} />
          </div>
          <div className="workspace-swatch-list mt-3">
            {visibleColors.map((color) => (
              <div key={color.id} className="workspace-swatch-item">
                <button className="workspace-dot workspace-dot-lg" style={{ backgroundColor: color.hex }} onClick={() => addWorkingColor({ hex: color.hex, value: color.value, sourceType: 'visible-cluster', label: `Visible ${color.hex}` })} />
                <div>
                  <p>{color.hex}</p>
                  <p className="text-xs text-[color:var(--text-muted)]">{Math.round(color.percent * 100)}% · v{color.value}</p>
                </div>
                <button
                  className="studio-button studio-button-secondary studio-button-compact"
                  onClick={() => setPinnedVisibleHexes((prev) => {
                    const next = new Set(prev);
                    if (next.has(color.hex)) next.delete(color.hex); else next.add(color.hex);
                    return next;
                  })}
                >
                  {pinnedVisibleHexes.has(color.hex) ? 'Unpin' : 'Pin'}
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="studio-kicker">Sections</p>
            <button
              className="studio-button studio-button-secondary studio-button-compact"
              onClick={() => {
                const section: Section = { id: createId('section'), name: `Section ${sections.length + 1}`, viewportSnapshot: viewport ? { x: viewport.offsetX, y: viewport.offsetY, zoom: viewport.zoom } : undefined };
                setSections((prev) => [...prev, section]);
                setActiveSectionId(section.id);
              }}
            >
              Add
            </button>
          </div>
          <div className="workspace-section-list mt-3">
            {sections.map((section) => (
              <button key={section.id} className={`workspace-section-btn ${activeSectionId === section.id ? 'active' : ''}`} onClick={() => setActiveSectionId(section.id)}>{section.name}</button>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="studio-kicker">Section palette</p>
            <select value={paletteView} onChange={(e) => setPaletteView(e.target.value as 'active' | 'all')}>
              <option value="active">Active section</option>
              <option value="all">All sections</option>
            </select>
          </div>
          <div className="workspace-swatch-list mt-3">
            {colorsInView.map((color) => (
              <article key={color.id} className={`workspace-color-card ${selectedColorId === color.id ? 'active' : ''}`}>
                <button className="workspace-dot workspace-dot-lg" style={{ backgroundColor: color.targetHex }} onClick={() => setSelectedColorId(color.id)} />
                <div>
                  <p>{color.label}</p>
                  <p className="text-xs text-[color:var(--text-muted)]">{color.targetHex} · v{color.value} · {color.status}</p>
                </div>
                <button className="studio-button studio-button-secondary studio-button-compact" onClick={() => solveForColor(color)}>Solve</button>
              </article>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <p className="studio-kicker">Target / predicted / actual</p>
          {selectedColor ? (
            <div className="space-y-3 mt-3">
              <div className="workspace-compare-grid">
                <div>
                  <p className="text-xs">Target</p>
                  <div className="workspace-dot workspace-dot-xl" style={{ backgroundColor: selectedColor.targetHex }} />
                </div>
                <div>
                  <p className="text-xs">Predicted</p>
                  <div className="workspace-dot workspace-dot-xl" style={{ backgroundColor: selectedColor.predictedRecipe?.predictedHex ?? '#1d232d' }} />
                </div>
                <div>
                  <p className="text-xs">Actual</p>
                  <input value={selectedColor.actualHex ?? ''} placeholder="#RRGGBB" onChange={(e) => setWorkingColors((prev) => prev.map((item) => item.id === selectedColor.id ? { ...item, actualHex: e.target.value } : item))} />
                </div>
              </div>
              <p className="text-xs text-[color:var(--text-muted)]">Temperature: {classifyTemperature(selectedColor.targetHex)}</p>
              {nearest ? <p className="text-xs text-[color:var(--text-muted)]">Nearest palette match: {nearest.label} ({nearest.hex}) · distance {nearest.distance.toFixed(1)}</p> : null}
              <textarea
                placeholder="Adjustment note"
                value={selectedColor.comparisonNote ?? ''}
                onChange={(e) => setWorkingColors((prev) => prev.map((item) => item.id === selectedColor.id ? { ...item, comparisonNote: e.target.value } : item))}
              />
              <button
                className="studio-button studio-button-secondary studio-button-compact"
                onClick={() => setWorkingColors((prev) => prev.map((item) => item.id === selectedColor.id ? {
                  ...item,
                  adjustmentLog: [
                    {
                      id: createId('adjust'),
                      note: item.comparisonNote?.trim() || 'manual adjustment',
                      tags: [],
                      createdAt: new Date().toISOString(),
                    },
                    ...item.adjustmentLog,
                  ],
                } : item))}
              >
                Log adjustment
              </button>
              {selectedColor.predictedRecipe ? <p className="text-xs">Recipe: {selectedColor.predictedRecipe.recipeText}</p> : <p className="text-xs text-[color:var(--text-muted)]">No prediction yet.</p>}
            </div>
          ) : <p className="text-sm text-[color:var(--text-muted)]">Select a working color to compare.</p>}
        </Card>
      </aside>
    </div>
  );
};
