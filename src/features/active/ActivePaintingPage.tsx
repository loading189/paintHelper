import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '../../components/Card';
import { solveColorTarget } from '../../lib/color/solvePipeline';
import { createId } from '../../lib/utils/id';
import type { Paint, PaintingSession, RankedRecipe, UserSettings } from '../../types/models';
import { FloatingColorWheel, type FloatingWheelPosition, type WheelColorNode, type WheelMode } from './FloatingColorWheel';
import { RecipePanel } from './RecipePanel';
import { UsedColorsTray, type UsedTrayColor } from './UsedColorsTray';
import { WorkspaceImagePanel } from './WorkspaceImagePanel';
import {
  fitViewport,
  isNearHex,
  toPainterValue,
  type DisplayMode,
  type GuideMode,
  type ViewportState,
  type VisibleColorCluster,
} from './workspaceUtils';

type ColorSource = 'image' | 'wheel-painting' | 'wheel-view' | 'wheel-saved' | 'used-tray';

type SelectedColor = {
  hex: string;
  value: number;
  source: ColorSource;
  point?: { x: number; y: number };
  label?: string;
};

type UsedColor = UsedTrayColor & {
  recipe?: string[];
  predictedHex?: string;
};

type ActivePaintingPageProps = {
  session: PaintingSession | null;
  paints: Paint[];
  settings: UserSettings;
  onSessionChange: (session: PaintingSession) => void;
};

const toNode = (color: VisibleColorCluster): WheelColorNode => ({
  id: color.id,
  hex: color.hex,
  value: color.value,
  weight: color.percent,
});

export const ActivePaintingPage = ({
  session,
  paints,
  settings,
  onSessionChange,
}: ActivePaintingPageProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedColor, setSelectedColor] = useState<SelectedColor | null>(null);
  const [wheelMode, setWheelMode] = useState<WheelMode>('painting');
  const [wheelExpanded, setWheelExpanded] = useState(false);
  const [wheelPosition, setWheelPosition] = useState<FloatingWheelPosition>({ x: 48, y: 90 });
  const [usedColors, setUsedColors] = useState<UsedColor[]>([]);
  const [viewport, setViewport] = useState<ViewportState | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('color');
  const [guideMode, setGuideMode] = useState<GuideMode>('quadrants');
  const [visibleColors, setVisibleColors] = useState<VisibleColorCluster[]>([]);
  const [paintingDominants, setPaintingDominants] = useState<VisibleColorCluster[]>([]);
  const [currentRecipe, setCurrentRecipe] = useState<RankedRecipe | null>(null);
  const [isSolving, setIsSolving] = useState(false);

  useEffect(() => {
    if (!selectedColor) {
      setCurrentRecipe(null);
      return;
    }

    setIsSolving(true);
    const solved = solveColorTarget(selectedColor.hex, paints, settings, 3);
    setCurrentRecipe(solved.rankedRecipes[0] ?? null);
    setIsSolving(false);
  }, [paints, selectedColor, settings]);

  if (!session) {
    return (
      <Card className="p-6 sm:p-7">
        <div className="space-y-3">
          <p className="studio-kicker">Paint</p>
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-strong)]">No project selected</h2>
          <p className="text-sm text-[color:var(--text-muted)]">Select or create a project to begin painting.</p>
        </div>
      </Card>
    );
  }

  const wheelNodes = useMemo(() => {
    if (wheelMode === 'saved') {
      return usedColors.map((entry) => ({
        id: entry.id,
        hex: entry.hex,
        value: entry.value,
        weight: 0.1,
        label: entry.label,
      }));
    }

    return (wheelMode === 'painting' ? paintingDominants : visibleColors).map(toNode);
  }, [wheelMode, usedColors, paintingDominants, visibleColors]);

  const selectColor = (next: SelectedColor) => setSelectedColor(next);

  const recalculate = () => {
    if (!selectedColor) return;
    const solved = solveColorTarget(selectedColor.hex, paints, settings, 3);
    setCurrentRecipe(solved.rankedRecipes[0] ?? null);
  };

  const addUsedColor = () => {
    if (!selectedColor) return;

    setUsedColors((prev) => {
      const alreadySaved = prev.some((entry) => isNearHex(entry.hex, selectedColor.hex, 8));
      if (alreadySaved) return prev;

      const next: UsedColor = {
        id: createId('used-color'),
        hex: selectedColor.hex,
        value: selectedColor.value,
        label: selectedColor.label,
        recipe: currentRecipe?.recipeText ? [currentRecipe.recipeText] : undefined,
        predictedHex: currentRecipe?.predictedHex,
      };

      return [next, ...prev];
    });
  };

  const updateSession = (patch: Partial<PaintingSession>) => {
    if (!session) return;
    onSessionChange({
      ...session,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file || !session) return;

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    updateSession({
      referenceImage: {
        id: createId('reference-image'),
        name: file.name,
        mimeType: file.type,
        dataUrl,
        addedAt: new Date().toISOString(),
      },
    });
  };

  return (
    <div className="paint-cockpit-layout">
      <section className="paint-cockpit-main">
        <Card className="paint-cockpit-stage-card">
          <div className="paint-cockpit-stage-header">
            <div className="paint-cockpit-actions-row">
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  void handleUpload(event.target.files?.[0]);
                  event.currentTarget.value = '';
                }}
              />
              <button
                className="studio-button studio-button-secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                {session.referenceImage ? 'Replace' : 'Upload'}
              </button>
              <button
                className="studio-button studio-button-secondary"
                onClick={() => updateSession({ referenceImage: undefined })}
                disabled={!session.referenceImage}
              >
                Clear
              </button>
              {session.referenceImage && (
                <span className="studio-chip studio-chip-info">{session.referenceImage.name}</span>
              )}
              <button
                className="studio-button studio-button-secondary"
                onClick={() => {
                  if (!viewport || !session.referenceImage) return;
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
              <button
                className="studio-button studio-button-secondary"
                onClick={() => viewport && setViewport({ ...viewport, zoom: Math.min(24, viewport.zoom * 1.18) })}
                disabled={!viewport}
              >
                +
              </button>
              <button
                className="studio-button studio-button-secondary"
                onClick={() => viewport && setViewport({ ...viewport, zoom: Math.max(0.1, viewport.zoom * 0.84) })}
                disabled={!viewport}
              >
                −
              </button>
            </div>
          </div>

          <div className="paint-cockpit-stage">
            <WorkspaceImagePanel
              image={session.referenceImage}
              displayMode={displayMode}
              guideMode={guideMode}
              viewport={viewport}
              onViewportChange={setViewport}
              onDisplayModeChange={setDisplayMode}
              onGuideModeChange={setGuideMode}
              onVisibleColorsChange={setVisibleColors}
              onPaintingDominantsChange={setPaintingDominants}
              onSample={({ hex, value, point }) =>
                selectColor({
                  hex,
                  value,
                  point,
                  source: 'image',
                  label: `Sample ${Math.round(point.x)}, ${Math.round(point.y)}`,
                })
              }
            />

            <FloatingColorWheel
              expanded={wheelExpanded}
              mode={wheelMode}
              position={wheelPosition}
              selectedHex={selectedColor?.hex}
              nodes={wheelNodes}
              onToggleExpanded={() => setWheelExpanded((prev) => !prev)}
              onMove={setWheelPosition}
              onChangeMode={setWheelMode}
              onSelectColor={(node) =>
                selectColor({
                  hex: node.hex,
                  value: node.value,
                  source:
                    wheelMode === 'painting'
                      ? 'wheel-painting'
                      : wheelMode === 'view'
                        ? 'wheel-view'
                        : 'wheel-saved',
                  label: node.label,
                })
              }
            />
          </div>
        </Card>
      </section>

      <Card className="paint-cockpit-right-rail">
        <RecipePanel
          selectedColor={selectedColor}
          recipe={currentRecipe}
          isSolving={isSolving}
          onRecalculate={recalculate}
          onMarkUsed={addUsedColor}
        />
      </Card>

      <UsedColorsTray
        usedColors={usedColors}
        activeHex={selectedColor?.hex}
        onSelect={(entry) =>
          selectColor({
            hex: entry.hex,
            value: entry.value || toPainterValue(0.5),
            source: 'used-tray',
            label: entry.label,
          })
        }
      />
    </div>
  );
};
