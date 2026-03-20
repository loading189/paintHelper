import { Card } from '../../components/Card';
import { MixPathBlock } from '../../components/MixPathBlock';
import { MixStatusChip } from '../../components/MixStatusChip';
import { NextAdjustmentBlock } from '../../components/NextAdjustmentBlock';
import { SectionTitle } from '../../components/SectionTitle';
import { SwatchComparisonPanel } from '../../components/SwatchComparisonPanel';
import type { MixStatus, PaintingSession } from '../../types/models';

const mixStatuses: MixStatus[] = ['not-mixed', 'mixed', 'adjusted', 'remix-needed'];

type ActivePaintingPageProps = {
  session: PaintingSession | null;
  onSessionChange: (session: PaintingSession) => void;
};

export const ActivePaintingPage = ({ session, onSessionChange }: ActivePaintingPageProps) => {
  if (!session) {
    return (
      <Card className="p-6 sm:p-7">
        <SectionTitle eyebrow="Paint" description="Open a project in Prep first, then Paint becomes the working image-and-recipe board.">
          No painting project selected
        </SectionTitle>
      </Card>
    );
  }

  const activeTargets = (session.activeTargetIds.length ? session.activeTargetIds : session.targetOrder)
    .map((id) => session.targets.find((target) => target.id === id))
    .filter((target): target is NonNullable<typeof target> => Boolean(target?.selectedRecipe));

  const updateMixStatus = (targetId: string, status: MixStatus) => {
    onSessionChange({
      ...session,
      updatedAt: new Date().toISOString(),
      targets: session.targets.map((target) => target.id === targetId ? { ...target, mixStatus: status } : target),
    });
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <Card className="p-5 sm:p-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr),320px] xl:items-end">
          <SectionTitle eyebrow="Paint" description="Work from the saved reference image, selected palette, and practical recipes without numeric clutter getting in the way.">
            Active Painting
          </SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="studio-metric"><p className="studio-eyebrow">Selected colors</p><p className="mt-2 text-2xl font-semibold text-[color:var(--text-strong)]">{activeTargets.length}</p><p className="mt-1 text-sm text-[color:var(--text-muted)]">Palette colors with saved recipes.</p></div>
            <div className="studio-metric"><p className="studio-eyebrow">Mixed</p><p className="mt-2 text-2xl font-semibold text-[color:var(--text-strong)]">{activeTargets.filter((target) => target.mixStatus === 'mixed').length}</p><p className="mt-1 text-sm text-[color:var(--text-muted)]">Already established on the palette.</p></div>
            <div className="studio-metric"><p className="studio-eyebrow">Reference image</p><p className="mt-2 text-lg font-semibold text-[color:var(--text-strong)]">{session.referenceImage ? 'Loaded' : 'Missing'}</p><p className="mt-1 text-sm text-[color:var(--text-muted)]">Paint mode keeps it visually prominent.</p></div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,0.95fr),minmax(0,1.05fr)]">
        <Card className="p-5 sm:p-7">
          <SectionTitle eyebrow="Reference image" description="The saved reference stays visible while you paint.">
            Painting image
          </SectionTitle>
          <div className="mt-5 rounded-[28px] border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] p-4">
            {session.referenceImage?.dataUrl ? (
              <img src={session.referenceImage.dataUrl} alt={session.referenceImage.name} className="max-h-[640px] w-full rounded-[20px] object-contain" />
            ) : (
              <div className="flex min-h-[360px] items-center justify-center rounded-[20px] border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-1)] text-sm text-[color:var(--text-muted)]">Add a reference image in Prep to keep it here while painting.</div>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          {activeTargets.length === 0 ? (
            <Card className="p-6 sm:p-7">
              <p className="studio-eyebrow">Nothing ready yet</p>
              <p className="mt-3 text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">Generate and save recipes in Prep to populate Paint mode.</p>
            </Card>
          ) : null}

          {activeTargets.map((target) => {
            const recipe = target.selectedRecipe!;
            return (
              <Card key={target.id} className="p-5 sm:p-7">
                <div className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-2xl font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">{target.label}</h3>
                        <MixStatusChip status={target.mixStatus} />
                      </div>
                      <p className="mt-2 text-sm text-[color:var(--text-muted)]">{target.valueRole ?? 'working color'} · {target.targetHex}</p>
                    </div>
                    <div className="rounded-[24px] border border-[rgba(38,33,29,0.12)] bg-[linear-gradient(180deg,rgba(40,34,31,0.98),rgba(30,26,23,0.96))] px-5 py-4 text-stone-50">
                      <p className="studio-eyebrow text-stone-300">Practical ratio</p>
                      <p className="mt-2 text-4xl font-semibold tracking-[-0.05em]">{recipe.practicalRatioText}</p>
                    </div>
                  </div>

                  <SwatchComparisonPanel targetHex={target.targetHex} predictedHex={recipe.predictedHex} targetHelper="Reference swatch" predictedHelper="Saved recipe swatch" />

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="studio-panel studio-panel-muted">
                      <p className="studio-eyebrow">Recipe</p>
                      <p className="mt-2 text-lg font-semibold text-[color:var(--text-strong)]">{recipe.recipeText}</p>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">{recipe.practicalPercentages.map((value) => `${value}%`).join(' · ')}</p>
                    </div>
                    <div className="studio-panel studio-panel-muted">
                      <p className="studio-eyebrow">Mix status</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {mixStatuses.map((status) => (
                          <button key={status} className={`studio-button ${target.mixStatus === status ? 'studio-button-primary' : 'studio-button-secondary'}`} type="button" onClick={() => updateMixStatus(target.id, status)}>
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <NextAdjustmentBlock adjustments={recipe.detailedAdjustments} />
                  <MixPathBlock steps={recipe.mixPath} warnings={recipe.stabilityWarnings} layeringSuggestion={recipe.layeringSuggestion} />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};
