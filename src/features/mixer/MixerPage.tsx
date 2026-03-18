import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/Card';
import { SectionTitle } from '../../components/SectionTitle';
import { hexToRgb, normalizeHex } from '../../lib/color/colorMath';
import { rankRecipes } from '../../lib/color/mixEngine';
import type { Paint, RankedRecipe, UserSettings } from '../../types/models';
import { RecipeCard } from './RecipeCard';

const DEFAULT_TARGET = '#7A8FB3';

type MixerPageProps = {
  paints: Paint[];
  settings: UserSettings;
  recentColors: string[];
  onSettingsChange: (settings: UserSettings) => void;
  onRecentColor: (hex: string) => void;
  onSaveRecipe: (recipe: RankedRecipe, targetHex: string) => void;
  onLoadTargetHex?: string | null;
};

export const MixerPage = ({
  paints,
  settings,
  recentColors,
  onSettingsChange,
  onRecentColor,
  onSaveRecipe,
  onLoadTargetHex,
}: MixerPageProps) => {
  const [targetInput, setTargetInput] = useState(onLoadTargetHex ?? DEFAULT_TARGET);
  const [touched, setTouched] = useState(false);

  const normalizedHex = normalizeHex(targetInput);
  const targetRgb = normalizedHex ? hexToRgb(normalizedHex) : null;
  const enabledPaints = paints.filter((paint) => paint.isEnabled);


  useEffect(() => {
    if (onLoadTargetHex) {
      setTargetInput(onLoadTargetHex);
    }
  }, [onLoadTargetHex]);

  const recipes = useMemo(
    () =>
      normalizedHex
        ? rankRecipes(normalizedHex, paints, settings.maxPaintsPerRecipe, settings.weightStep, 3)
        : [],
    [normalizedHex, paints, settings.maxPaintsPerRecipe, settings.weightStep],
  );

  const applyTarget = (value: string) => {
    setTargetInput(value);
    const normalized = normalizeHex(value);
    if (normalized) {
      onRecentColor(normalized);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[320px,320px,minmax(0,1fr)]">
      <Card>
        <SectionTitle>Mixer controls</SectionTitle>
        <div className="mt-4 space-y-4">
          <label className="block space-y-1 text-sm font-medium text-slate-700">
            Target hex
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
              value={targetInput}
              onChange={(event) => {
                setTouched(true);
                setTargetInput(event.target.value);
              }}
              placeholder="#7A8FB3"
            />
          </label>
          <label className="block space-y-1 text-sm font-medium text-slate-700">
            Target picker
            <input
              type="color"
              className="h-12 w-full rounded-xl border border-slate-300 p-1"
              value={normalizedHex ?? '#000000'}
              onChange={(event) => applyTarget(event.target.value)}
            />
          </label>
          <button
            className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            type="button"
            onClick={() => {
              setTouched(true);
              if (normalizedHex) {
                applyTarget(normalizedHex);
              }
            }}
          >
            Generate recipes
          </button>
          {!normalizedHex && touched ? <p className="text-sm text-rose-600">Enter a valid 6-digit hex color.</p> : null}
          {enabledPaints.length === 0 ? <p className="text-sm text-amber-700">Enable at least one paint in My Paints to generate mixes.</p> : null}
        </div>

        <div className="mt-6 space-y-4">
          <SectionTitle>Settings</SectionTitle>
          <label className="block space-y-1 text-sm font-medium text-slate-700">
            Weight step size
            <select
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
              value={settings.weightStep}
              onChange={(event) => onSettingsChange({ ...settings, weightStep: Number(event.target.value) })}
            >
              <option value={10}>10%</option>
              <option value={5}>5%</option>
            </select>
          </label>
          <label className="block space-y-1 text-sm font-medium text-slate-700">
            Max paints per recipe
            <select
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
              value={settings.maxPaintsPerRecipe}
              onChange={(event) =>
                onSettingsChange({ ...settings, maxPaintsPerRecipe: Number(event.target.value) as 1 | 2 | 3 })
              }
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
          <label className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
            Show percentages
            <input
              type="checkbox"
              checked={settings.showPercentages}
              onChange={(event) => onSettingsChange({ ...settings, showPercentages: event.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
            Show parts ratios
            <input
              type="checkbox"
              checked={settings.showPartsRatios}
              onChange={(event) => onSettingsChange({ ...settings, showPartsRatios: event.target.checked })}
            />
          </label>
        </div>
      </Card>

      <Card>
        <SectionTitle>Target color</SectionTitle>
        <div className="mt-4 space-y-4">
          <div className="h-56 rounded-3xl border border-slate-200" style={{ backgroundColor: normalizedHex ?? '#CBD5E1' }} />
          <div>
            <p className="text-sm text-slate-500">Normalized hex</p>
            <p className="text-xl font-semibold text-slate-900">{normalizedHex ?? 'Invalid hex'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">RGB</p>
            <p className="text-base text-slate-800">
              {targetRgb ? `${targetRgb.r}, ${targetRgb.g}, ${targetRgb.b}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Recent colors</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {recentColors.map((color) => (
                <button
                  key={color}
                  className="h-9 w-9 rounded-full border border-slate-200"
                  type="button"
                  style={{ backgroundColor: color }}
                  title={color}
                  onClick={() => applyTarget(color)}
                />
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <div>
          <SectionTitle>Top recipe suggestions</SectionTitle>
          <p className="mt-1 text-sm text-slate-600">Deterministic ranking in linear RGB using only enabled paints from your local inventory.</p>
        </div>
        {normalizedHex && enabledPaints.length > 0 && recipes.length > 0 ? (
          recipes.map((recipe, index) => (
            <RecipeCard
              key={`${recipe.predictedHex}-${index}`}
              rank={index + 1}
              recipe={recipe}
              paints={paints}
              showPercentages={settings.showPercentages}
              showPartsRatios={settings.showPartsRatios}
              onSave={(rankedRecipe) => onSaveRecipe(rankedRecipe, normalizedHex)}
            />
          ))
        ) : (
          <Card>
            <p className="text-sm text-slate-600">
              {enabledPaints.length === 0
                ? 'No enabled paints are available for recipe generation.'
                : 'Generate recipes to see the closest mixes.'}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};
