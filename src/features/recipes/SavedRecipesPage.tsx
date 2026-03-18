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
        <p className="mt-1 text-sm text-slate-600">Store promising matches locally, add notes, and reload the target color into the mixer.</p>
      </div>

      {recipes.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">No recipes saved yet. Generate a match in Mixer and save it here.</p>
        </Card>
      ) : (
        recipes.map((recipe) => {
          const isEditing = editingId === recipe.id;
          return (
            <Card key={recipe.id}>
              <div className="grid gap-4 lg:grid-cols-[110px,minmax(0,1fr),auto] lg:items-start">
                <div>
                  <div className="h-24 rounded-2xl border border-slate-200" style={{ backgroundColor: recipe.predictedHex }} />
                  <p className="mt-2 text-sm font-medium text-slate-800">{recipe.predictedHex}</p>
                  <p className="text-xs text-slate-500">Target {recipe.targetHex}</p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{recipe.savedName || 'Untitled recipe'}</h3>
                  <p className="text-sm text-slate-500">Distance {formatDistance(recipe.distanceScore)} · {new Date(recipe.createdAt).toLocaleString()}</p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-700">
                    {recipe.components.map((component) => (
                      <li key={component.paintId}>
                        {paintMap.get(component.paintId) ?? component.paintId} — {component.percentage}%
                      </li>
                    ))}
                  </ul>
                  {isEditing ? (
                    <div className="mt-4 space-y-3">
                      <input
                        className="w-full rounded-xl border border-slate-300 px-3 py-2"
                        value={recipe.savedName ?? ''}
                        placeholder="Recipe name"
                        onChange={(event) => onUpdate({ ...recipe, savedName: event.target.value })}
                      />
                      <textarea
                        className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2"
                        value={recipe.notes ?? ''}
                        placeholder="Notes"
                        onChange={(event) => onUpdate({ ...recipe, notes: event.target.value })}
                      />
                    </div>
                  ) : recipe.notes ? (
                    <p className="mt-3 text-sm text-slate-600">{recipe.notes}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 lg:flex-col">
                  <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white" type="button" onClick={() => onLoadIntoMixer(recipe)}>
                    Load into mixer
                  </button>
                  <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" type="button" onClick={() => setEditingId(isEditing ? null : recipe.id)}>
                    {isEditing ? 'Done' : 'Edit details'}
                  </button>
                  <button className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600" type="button" onClick={() => onDelete(recipe.id)}>
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
