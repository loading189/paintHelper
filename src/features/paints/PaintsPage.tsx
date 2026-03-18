import { useMemo, useRef, useState } from 'react';
import { Card } from '../../components/Card';
import { SectionTitle } from '../../components/SectionTitle';
import type { Paint } from '../../types/models';
import { PaintForm, type PaintDraft } from './PaintForm';
import { createId } from '../../lib/utils/id';
import { normalizeHex } from '../../lib/color/colorMath';
import { downloadJson } from '../../lib/utils/format';

const paintMatches = (paint: Paint, query: string): boolean => {
  const haystack = `${paint.name} ${paint.brand ?? ''} ${paint.notes ?? ''}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
};

type PaintsPageProps = {
  paints: Paint[];
  onCreate: (paint: Paint) => void;
  onUpdate: (paint: Paint) => void;
  onDelete: (paintId: string) => void;
};

export const PaintsPage = ({ paints, onCreate, onUpdate, onDelete }: PaintsPageProps) => {
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const visiblePaints = useMemo(() => paints.filter((paint) => paintMatches(paint, query)), [paints, query]);
  const editingPaint = paints.find((paint) => paint.id === editingId);
  const enabledCount = paints.filter((paint) => paint.isEnabled).length;

  const handleCreate = (draft: PaintDraft) => {
    onCreate({ ...draft, id: createId('paint') });
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        throw new Error('Expected an array of paints.');
      }

      parsed.forEach((item) => {
        if (!item || typeof item !== 'object' || typeof item.name !== 'string' || typeof item.hex !== 'string') {
          throw new Error('Each paint needs at least a name and hex value.');
        }

        const normalizedHex = normalizeHex(String(item.hex));
        if (!normalizedHex) {
          throw new Error(`Invalid hex for ${item.name}.`);
        }

        onCreate({
          id: createId('paint'),
          name: item.name,
          brand: typeof item.brand === 'string' ? item.brand : undefined,
          hex: normalizedHex,
          notes: typeof item.notes === 'string' ? item.notes : undefined,
          isWhite: Boolean(item.isWhite),
          isBlack: Boolean(item.isBlack),
          isEnabled: item.isEnabled ?? true,
          opacity: item.opacity,
          temperatureBias: item.temperatureBias,
          heuristics: item.heuristics,
        });
      });

      setImportError('');
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Unable to import paints JSON.');
    }
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <Card className="p-5 sm:p-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),360px] xl:items-start">
          <SectionTitle
            eyebrow="Paint library"
            description="Maintain the inventory the mixer can search, keep tube metadata clean, and curate which paints stay active for recipe generation."
          >
            Studio paint inventory
          </SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {[
              { label: 'Total paints', value: paints.length, note: 'all stored paint records' },
              { label: 'Enabled paints', value: enabledCount, note: 'available to the mixer' },
              { label: 'Visible results', value: visiblePaints.length, note: query ? 'matching current search' : 'current inventory view' },
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

      <Card className="p-5 sm:p-7">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <SectionTitle eyebrow="Inventory actions" description="Import, export, and add paints without leaving the studio palette management flow.">
            Add or migrate paints
          </SectionTitle>
          <div className="flex flex-wrap gap-3">
            <button className="studio-button studio-button-secondary" type="button" onClick={() => downloadJson('paint-mix-matcher-paints.json', paints)}>
              Export JSON
            </button>
            <button className="studio-button studio-button-secondary" type="button" onClick={() => fileInputRef.current?.click()}>
              Import JSON
            </button>
            <input ref={fileInputRef} className="hidden" type="file" accept="application/json" onChange={(event) => void handleImport(event.target.files?.[0])} />
          </div>
        </div>
        <PaintForm onSubmit={handleCreate} />
        {importError ? <p className="mt-4 rounded-[22px] border border-[rgba(146,92,92,0.18)] bg-[rgba(146,92,92,0.08)] px-4 py-3 text-sm text-[#7f514f]">{importError}</p> : null}
      </Card>

      {editingPaint ? (
        <Card className="p-5 sm:p-7">
          <SectionTitle eyebrow="Selected paint" description="Refine tube metadata and role hints without disturbing the rest of the inventory.">
            Edit paint details
          </SectionTitle>
          <div className="mt-6">
            <PaintForm
              initialValue={editingPaint}
              onCancel={() => setEditingId(null)}
              onSubmit={(draft) => {
                onUpdate({ ...draft, id: editingPaint.id });
                setEditingId(null);
              }}
            />
          </div>
        </Card>
      ) : null}

      <Card className="p-5 sm:p-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <SectionTitle eyebrow="Inventory browser" description="Search by paint name, brand, or notes and keep the visual swatch front-and-center.">
            My paints
          </SectionTitle>
          <label className="w-full xl:max-w-sm">
            <span className="mb-2 block text-[13px] font-semibold tracking-[-0.01em] text-[color:var(--text-strong)]">Search paints</span>
            <input className="studio-input" placeholder="Search by name, brand, or notes" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {visiblePaints.map((paint) => (
            <article key={paint.id} className="rounded-[30px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)]/74 p-5 shadow-sm">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-4">
                  <div className="swatch-well rounded-[24px] border border-[color:var(--border-strong)] bg-[color:var(--surface-2)] p-3">
                    <div className="h-16 w-16 rounded-[18px] border border-black/10" style={{ backgroundColor: paint.hex }} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold tracking-[-0.02em] text-[color:var(--text-strong)]">{paint.name}</h3>
                      <span className={`studio-chip ${paint.isEnabled ? 'studio-chip-success' : ''}`}>{paint.isEnabled ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    <p className="mt-1 text-sm text-[color:var(--text-muted)]">{paint.brand ?? 'No brand'} · {paint.hex}</p>
                    <p className="mt-2 text-sm text-[color:var(--text-muted)]">
                      {paint.opacity ?? 'opacity unspecified'} · {paint.temperatureBias ?? 'neutral temperature'}
                    </p>
                    {paint.notes ? <p className="mt-3 text-sm leading-6 text-[color:var(--text-body)]">{paint.notes}</p> : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 sm:max-w-[180px] sm:justify-end">
                  <button className="studio-button studio-button-secondary" type="button" onClick={() => onUpdate({ ...paint, isEnabled: !paint.isEnabled })}>
                    {paint.isEnabled ? 'Disable' : 'Enable'}
                  </button>
                  <button className="studio-button studio-button-secondary" type="button" onClick={() => setEditingId(paint.id)}>
                    Edit
                  </button>
                  <button
                    className="studio-button rounded-full border border-[rgba(146,92,92,0.18)] bg-[rgba(146,92,92,0.08)] px-5 py-3 text-sm font-semibold text-[#7f514f]"
                    type="button"
                    onClick={() => onDelete(paint.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {paint.isWhite ? <span className="studio-chip">White</span> : null}
                {paint.isBlack ? <span className="studio-chip">Black</span> : null}
                {paint.heuristics?.tintStrength ? <span className="studio-chip studio-chip-info">Tint {paint.heuristics.tintStrength}</span> : null}
                {paint.heuristics?.naturalBias ? <span className="studio-chip">{paint.heuristics.naturalBias}</span> : null}
              </div>
            </article>
          ))}
        </div>

        {visiblePaints.length === 0 ? (
          <div className="mt-6 rounded-[28px] border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-1)]/74 px-5 py-8 text-center">
            <p className="studio-eyebrow">No visible paints</p>
            <p className="mt-3 text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">No paints match this search</p>
            <p className="mt-3 text-sm leading-7 text-[color:var(--text-muted)]">Try a broader name or brand search, or clear the query to review the full inventory.</p>
          </div>
        ) : null}
      </Card>
    </div>
  );
};
