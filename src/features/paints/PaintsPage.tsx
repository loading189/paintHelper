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
        });
      });

      setImportError('');
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Unable to import paints JSON.');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <SectionTitle>Paint inventory</SectionTitle>
            <p className="mt-1 text-sm text-slate-600">Add paints, tune metadata, and control which tubes are considered by the mixer.</p>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
              type="button"
              onClick={() => downloadJson('paint-mix-matcher-paints.json', paints)}
            >
              Export JSON
            </button>
            <button
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
              type="button"
              onClick={() => fileInputRef.current?.click()}
            >
              Import JSON
            </button>
            <input
              ref={fileInputRef}
              className="hidden"
              type="file"
              accept="application/json"
              onChange={(event) => void handleImport(event.target.files?.[0])}
            />
          </div>
        </div>
        <PaintForm onSubmit={handleCreate} />
        {importError ? <p className="mt-3 text-sm text-rose-600">{importError}</p> : null}
      </Card>

      {editingPaint ? (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <SectionTitle>Edit paint</SectionTitle>
          </div>
          <PaintForm
            initialValue={editingPaint}
            onCancel={() => setEditingId(null)}
            onSubmit={(draft) => {
              onUpdate({ ...draft, id: editingPaint.id });
              setEditingId(null);
            }}
          />
        </Card>
      ) : null}

      <Card>
        <div className="mb-4 flex items-center justify-between gap-4">
          <SectionTitle>My paints</SectionTitle>
          <input
            className="w-full max-w-sm rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Search paints"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          {visiblePaints.map((paint) => (
            <article key={paint.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-2xl border border-slate-200" style={{ backgroundColor: paint.hex }} />
                  <div>
                    <h3 className="font-semibold text-slate-900">{paint.name}</h3>
                    <p className="text-sm text-slate-500">{paint.brand ?? 'No brand'} · {paint.hex}</p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
                      {paint.isEnabled ? 'Enabled' : 'Disabled'} · {paint.opacity ?? 'unspecified'} · {paint.temperatureBias ?? 'neutral'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                    type="button"
                    onClick={() => onUpdate({ ...paint, isEnabled: !paint.isEnabled })}
                  >
                    {paint.isEnabled ? 'Disable' : 'Enable'}
                  </button>
                  <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" type="button" onClick={() => setEditingId(paint.id)}>
                    Edit
                  </button>
                  <button className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-600" type="button" onClick={() => onDelete(paint.id)}>
                    Delete
                  </button>
                </div>
              </div>
              {paint.notes ? <p className="mt-3 text-sm text-slate-600">{paint.notes}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                {paint.isWhite ? <span className="rounded-full bg-slate-100 px-2 py-1">White</span> : null}
                {paint.isBlack ? <span className="rounded-full bg-slate-100 px-2 py-1">Black</span> : null}
              </div>
            </article>
          ))}
        </div>
        {visiblePaints.length === 0 ? <p className="text-sm text-slate-500">No paints match your current search.</p> : null}
      </Card>
    </div>
  );
};
