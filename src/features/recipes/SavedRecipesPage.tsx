import { useState } from 'react';
import { Card } from '../../components/Card';
import { SectionTitle } from '../../components/SectionTitle';
import { SwatchTile } from '../../components/SwatchTile';
import { formatDistance } from '../../lib/utils/format';
import type { MixRecipe, Paint } from '../../types/models';
import styles from './SavedRecipesPage.module.css';

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
    <div className={styles.pageStack}>
      <Card className={styles.sectionCard}>
        <div className={styles.summaryGrid}>
          <SectionTitle
            eyebrow="Saved references"
            description="Archive strong local matches, annotate them, and reload the original target when you want to continue mixing from a known point."
          >
            Saved recipe archive
          </SectionTitle>
          <div className={styles.metricsGrid}>
            {[
              { label: 'Saved recipes', value: recipes.length, note: 'stored locally in this browser' },
              { label: 'Ready to reload', value: recipes.filter((recipe) => recipe.targetHex).length, note: 'targets available to send back into Mixer' },
            ].map((item) => (
              <div key={item.label} className="studio-metric">
                <p className="studio-eyebrow">{item.label}</p>
                <p className={styles.metricValue}>{item.value}</p>
                <p className={styles.metricNote}>{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {recipes.length === 0 ? (
        <Card className={styles.sectionCard}>
          <div className={styles.emptyState}>
            <p className="studio-eyebrow">Archive empty</p>
            <p className={styles.emptyTitle}>No saved recipes yet</p>
            <p className={styles.emptyCopy}>Save a strong recipe from Mixer and it will appear here as a reusable studio reference with notes and adjustment guidance.</p>
          </div>
        </Card>
      ) : (
        recipes.map((recipe) => {
          const isEditing = editingId === recipe.id;
          return (
            <Card key={recipe.id} className={styles.sectionCard}>
              <div className={styles.recipeGrid}>
                <div>
                  <div className={styles.recipeHeader}>
                    <div>
                      <p className="studio-eyebrow">Saved recipe</p>
                      <h3 className={styles.recipeTitle}>{recipe.savedName || 'Untitled recipe'}</h3>
                      <p className={styles.recipeMeta}>
                        Painter score {formatDistance(recipe.distanceScore)} · saved {new Date(recipe.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className={styles.recipeChips}>
                      {recipe.qualityLabel ? <span className="studio-chip studio-chip-success">{recipe.qualityLabel}</span> : null}
                      {recipe.practicalRatioText ? <span className="studio-chip studio-chip-info">Practical {recipe.practicalRatioText}</span> : null}
                    </div>
                  </div>

                  <div className={styles.swatchRow}>
                    <SwatchTile label="Target" hex={recipe.targetHex} helper="Original target" footer="Reload this target to continue mixing from the same reference." />
                    <SwatchTile label="Predicted" hex={recipe.predictedHex} helper="Saved result" footer="Stored prediction associated with this saved recipe." />
                  </div>

                  <div className={styles.detailGrid}>
                    <div className={`studio-surface studio-surface-strong ${styles.mixSurface}`}>
                      <p className="studio-eyebrow">Mix summary</p>
                      {recipe.practicalRatioText ? <p className={styles.ratioText}>{recipe.practicalRatioText}</p> : null}
                      {recipe.exactRatioText && recipe.exactRatioText !== recipe.practicalRatioText ? <p className={styles.exactText}>Exact ratio: {recipe.exactRatioText}</p> : null}
                      <ul className={styles.componentList}>
                        {recipe.components.map((component, index) => (
                          <li key={component.paintId} className={styles.componentItem}>
                            <span className={styles.componentName}>{paintMap.get(component.paintId)?.name ?? component.paintId}</span>
                            {recipe.practicalParts?.[index] ? ` — ${recipe.practicalParts[index]} parts` : ''}
                            {recipe.practicalPercentages?.[index] ? ` · ${recipe.practicalPercentages[index]}%` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className={styles.sideStack}>
                      {recipe.nextAdjustments?.length ? (
                        <div className={styles.adjustmentsBox}>
                          <p className="studio-eyebrow">Next adjustments</p>
                          <ul className={styles.adjustmentsList}>
                            {recipe.nextAdjustments.map((line) => (
                              <li key={line} className={styles.adjustmentsItem}>
                                {line}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {isEditing ? (
                        <div className={`studio-surface studio-surface-muted ${styles.editorSurface}`}>
                          <label className={styles.fieldLabel}>
                            <span className={styles.fieldTitle}>Reference name</span>
                            <input className="studio-input" value={recipe.savedName ?? ''} placeholder="Recipe name" onChange={(event) => onUpdate({ ...recipe, savedName: event.target.value })} />
                          </label>
                          <label className={styles.fieldLabel}>
                            <span className={styles.fieldTitle}>Studio notes</span>
                            <textarea className={`studio-textarea ${styles.notesInput}`} value={recipe.notes ?? ''} placeholder="Notes" onChange={(event) => onUpdate({ ...recipe, notes: event.target.value })} />
                          </label>
                        </div>
                      ) : recipe.notes ? (
                        <div className={`studio-surface studio-surface-muted ${styles.notesSurface}`}>
                          <p className="studio-eyebrow">Notes</p>
                          <p className={styles.notesCopy}>{recipe.notes}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className={styles.actionsCard}>
                  <p className="studio-eyebrow">Archive actions</p>
                  <div className={styles.actionsStack}>
                    <button className={`studio-button studio-button-primary ${styles.fullButton}`} type="button" onClick={() => onLoadIntoMixer(recipe)}>
                      Load into mixer
                    </button>
                    <button className={`studio-button studio-button-secondary ${styles.fullButton}`} type="button" onClick={() => setEditingId(isEditing ? null : recipe.id)}>
                      {isEditing ? 'Done editing' : 'Edit details'}
                    </button>
                    <button className={`studio-button studio-button-danger ${styles.fullButton}`} type="button" onClick={() => onDelete(recipe.id)}>
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
