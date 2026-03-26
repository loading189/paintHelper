import { useState } from 'react';
import { Card } from '../../components/Card';
import { SectionTitle } from '../../components/SectionTitle';
import { SwatchTile } from '../../components/SwatchTile';
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
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));

  return (
    <div className="space-y-6 lg:space-y-8">
      <Card className="p-5 sm:p-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),360px] xl:items-end">
          <SectionTitle
            eyebrow="Saved references"
            description="Archive strong local matches, annotate them, and reload the original target when you want to continue mixing from a known point."
          >
            Saved recipe archive
          </SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {[
              { label: 'Saved recipes', value: recipes.length, note: 'stored locally in this browser' },
              { label: 'Ready to reload', value: recipes.filter((recipe) => recipe.targetHex).length, note: 'targets available to send back into Mixer' },
            ].map((item) => (
              <div key={item.label} className="studio-metric">
                <p className="studio-eyebrow">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">{item.value}</p>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {recipes.length === 0 ? (
        <Card className="p-6 sm:p-7">
          <div className="rounded-[28px] border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-1)]/74 px-5 py-10 text-center">
            <p className="studio-eyebrow">Archive empty</p>
            <p className="mt-3 text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">No saved recipes yet</p>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[color:var(--text-muted)]">Save a strong recipe from Mixer and it will appear here as a reusable studio reference with notes and adjustment guidance.</p>
          </div>
        </Card>
      ) : (
        recipes.map((recipe) => {
          const isEditing = editingId === recipe.id;
          return (
            <Card key={recipe.id} className="p-5 sm:p-7">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr),320px]">
                <div>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="studio-eyebrow">Saved recipe</p>
                      <h3 className="mt-2 text-[1.55rem] font-semibold tracking-[-0.04em] text-[color:var(--text-strong)]">{recipe.savedName || 'Untitled recipe'}</h3>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
                        Painter score {formatDistance(recipe.distanceScore)} · saved {new Date(recipe.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recipe.qualityLabel ? <span className="studio-chip studio-chip-success">{recipe.qualityLabel}</span> : null}
                      {recipe.practicalRatioText ? <span className="studio-chip studio-chip-info">Practical {recipe.practicalRatioText}</span> : null}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <SwatchTile label="Target" hex={recipe.targetHex} helper="Original target" footer="Reload this target to continue mixing from the same reference." />
                    <SwatchTile label="Predicted" hex={recipe.predictedHex} helper="Saved result" footer="Stored prediction associated with this saved recipe." />
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.1fr),minmax(0,0.9fr)]">
                    <div className="studio-surface studio-surface-strong px-5 py-5">
                      <p className="studio-eyebrow">Mix summary</p>
                      {recipe.practicalRatioText ? <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--text-strong)]">{recipe.practicalRatioText}</p> : null}
                      {recipe.exactRatioText && recipe.exactRatioText !== recipe.practicalRatioText ? <p className="mt-2 text-sm text-[color:var(--text-muted)]">Exact ratio: {recipe.exactRatioText}</p> : null}
                      <ul className="mt-4 space-y-2.5 text-sm leading-6 text-[color:var(--text-body)]">
                        {recipe.components.map((component, index) => (
                          <li key={component.paintId} className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] px-4 py-3">
                            <span className="font-semibold text-[color:var(--text-strong)]">{paintMap.get(component.paintId)?.name ?? component.paintId}</span>
                            {recipe.practicalParts?.[index] ? ` — ${recipe.practicalParts[index]} parts` : ''}
                            {recipe.practicalPercentages?.[index] ? ` · ${recipe.practicalPercentages[index]}%` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-4">
                      {recipe.nextAdjustments?.length ? (
                        <div className="rounded-[28px] border border-[rgba(84,111,88,0.16)] bg-[rgba(84,111,88,0.08)] px-5 py-5 text-sm text-[color:var(--text-body)]">
                          <p className="studio-eyebrow">Next adjustments</p>
                          <ul className="mt-3 space-y-2.5 leading-6">
                            {recipe.nextAdjustments.map((line) => (
                              <li key={line} className="rounded-[20px] border border-[rgba(84,111,88,0.14)] bg-[rgba(251,248,243,0.74)] px-4 py-3">
                                {line}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {isEditing ? (
                        <div className="studio-surface studio-surface-muted space-y-3 px-5 py-5">
                          <label className="block">
                            <span className="mb-2 block text-[13px] font-semibold tracking-[-0.01em] text-[color:var(--text-strong)]">Reference name</span>
                            <input className="studio-input" value={recipe.savedName ?? ''} placeholder="Recipe name" onChange={(event) => onUpdate({ ...recipe, savedName: event.target.value })} />
                          </label>
                          <label className="block">
                            <span className="mb-2 block text-[13px] font-semibold tracking-[-0.01em] text-[color:var(--text-strong)]">Studio notes</span>
                            <textarea className="studio-textarea min-h-28" value={recipe.notes ?? ''} placeholder="Notes" onChange={(event) => onUpdate({ ...recipe, notes: event.target.value })} />
                          </label>
                        </div>
                      ) : recipe.notes ? (
                        <div className="studio-surface studio-surface-muted px-5 py-5">
                          <p className="studio-eyebrow">Notes</p>
                          <p className="mt-3 text-sm leading-7 text-[color:var(--text-body)]">{recipe.notes}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="rounded-[30px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)]/72 p-5">
                  <p className="studio-eyebrow">Archive actions</p>
                  <div className="mt-5 flex flex-col gap-3">
                    <button className="studio-button studio-button-primary w-full" type="button" onClick={() => onLoadIntoMixer(recipe)}>
                      Load into mixer
                    </button>
                    <button className="studio-button studio-button-secondary w-full" type="button" onClick={() => setEditingId(isEditing ? null : recipe.id)}>
                      {isEditing ? 'Done editing' : 'Edit details'}
                    </button>
                    <button
                      className="studio-button studio-button-danger w-full"
                      type="button"
                      onClick={() => onDelete(recipe.id)}
                    >
                      Delete recipe
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
};
