import { useState } from 'react';
import { Card } from '../../components/Card';
import { SectionTitle } from '../../components/SectionTitle';
import type { MixRecipe, Paint } from '../../types/models';
import { formatDistance } from '../../lib/utils/format';

type SavedRecipesPageProps = {
  recipes: MixRecipe[];
  paints: Paint[];
  onDelete: (recipeId: string) => void;
  onLoadIntoMixer: (recipe: MixRecipe) => void;
  onUpdate: (recipe: MixRecipe) => void;
};

export const SavedRecipesPage = ({ recipes, paints, onDelete, onLoadIntoMixer, onUpdate }: SavedRecipesPageProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const paintMap = new Map(paints.map((paint) => [paint.id, paint.name]));

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Saved recipes</SectionTitle>
        <p className="mt-2 text-sm leading-6 text-stone-600">Store strong local matches, jot mixing notes, and reload the original target into the mixer.</p>
      </div>

      {recipes.length === 0 ? (
        <Card>
          <p className="text-sm leading-6 text-stone-600">No recipes saved yet. Generate a match in Mixer and save it here.</p>
        </Card>
      ) : (
        recipes.map((recipe) => {
          const isEditing = editingId === recipe.id;
          return (
            <Card key={recipe.id}>
              <div className="grid gap-5 lg:grid-cols-[140px,minmax(0,1fr),auto] lg:items-start">
                <div>
                  <div className="rounded-3xl border border-stone-200 bg-stone-100 p-3">
                    <div className="rounded-2xl border border-stone-300 bg-stone-200 p-2">
                      <div className="h-24 rounded-xl border border-black/8" style={{ backgroundColor: recipe.predictedHex }} />
                    </div>
                  </div>
                  <p className="mt-2 text-sm font-medium text-stone-800">{recipe.predictedHex}</p>
                  <p className="text-xs text-stone-500">Target {recipe.targetHex}</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-stone-950">{recipe.savedName || 'Untitled recipe'}</h3>
                  <p className="text-sm text-stone-500">Painter score {formatDistance(recipe.distanceScore)} · {new Date(recipe.createdAt).toLocaleString()}</p>
                  {recipe.qualityLabel ? <p className="mt-1 text-sm font-medium text-stone-800">{recipe.qualityLabel}</p> : null}
                  {recipe.practicalRatioText ? <p className="mt-3 text-sm font-semibold text-stone-900">Practical ratio: {recipe.practicalRatioText}</p> : null}
                  {recipe.exactRatioText && recipe.exactRatioText !== recipe.practicalRatioText ? <p className="mt-1 text-xs text-stone-500">Exact ratio: {recipe.exactRatioText}</p> : null}
                  <ul className="mt-3 space-y-2 text-sm text-stone-700">
                    {recipe.components.map((component, index) => (
                      <li key={component.paintId}>
                        {paintMap.get(component.paintId) ?? component.paintId}
                        {recipe.practicalParts?.[index] ? ` — ${recipe.practicalParts[index]} parts` : ''}
                        {recipe.practicalPercentages?.[index] ? ` · ${recipe.practicalPercentages[index]}%` : ''}
                      </li>
                    ))}
                  </ul>
                  {recipe.nextAdjustments?.length ? (
                    <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-700">
                      <p className="font-semibold text-stone-950">Next adjustments</p>
                      <ul className="mt-2 space-y-1.5">
                        {recipe.nextAdjustments.map((line) => (
                          <li key={line}>• {line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {isEditing ? (
                    <div className="mt-4 space-y-3">
                      <input
                        className="w-full rounded-2xl border border-stone-300 bg-white px-3 py-2.5"
                        value={recipe.savedName ?? ''}
                        placeholder="Recipe name"
                        onChange={(event) => onUpdate({ ...recipe, savedName: event.target.value })}
                      />
                      <textarea
                        className="min-h-24 w-full rounded-2xl border border-stone-300 bg-white px-3 py-2.5"
                        value={recipe.notes ?? ''}
                        placeholder="Notes"
                        onChange={(event) => onUpdate({ ...recipe, notes: event.target.value })}
                      />
                    </div>
                  ) : recipe.notes ? (
                    <p className="mt-3 text-sm text-stone-600">{recipe.notes}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 lg:flex-col">
                  <button className="rounded-2xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-stone-50" type="button" onClick={() => onLoadIntoMixer(recipe)}>
                    Load into mixer
                  </button>
                  <button className="rounded-2xl border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-700" type="button" onClick={() => setEditingId(isEditing ? null : recipe.id)}>
                    {isEditing ? 'Done' : 'Edit details'}
                  </button>
                  <button className="rounded-2xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700" type="button" onClick={() => onDelete(recipe.id)}>
                    Delete
                  </button>
                </div>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
};
