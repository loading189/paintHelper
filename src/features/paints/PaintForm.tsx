import { type FormEvent, useEffect, useState } from 'react';
import type { Opacity, Paint, TemperatureBias } from '../../types/models';
import { normalizeHex } from '../../lib/color/colorMath';

const opacityOptions: Opacity[] = ['transparent', 'semi-transparent', 'semi-opaque', 'opaque'];
const temperatureOptions: TemperatureBias[] = ['warm', 'cool', 'neutral'];

export type PaintDraft = Omit<Paint, 'id'>;

const emptyDraft: PaintDraft = {
  name: '',
  brand: '',
  hex: '#000000',
  notes: '',
  isWhite: false,
  isBlack: false,
  isEnabled: true,
  opacity: 'opaque',
  temperatureBias: 'neutral',
};

type PaintFormProps = {
  initialValue?: Paint;
  onCancel?: () => void;
  onSubmit: (draft: PaintDraft) => void;
};

export const PaintForm = ({ initialValue, onCancel, onSubmit }: PaintFormProps) => {
  const [draft, setDraft] = useState<PaintDraft>(initialValue ? { ...initialValue } : emptyDraft);
  const [hexInput, setHexInput] = useState(initialValue?.hex ?? '#000000');
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialValue) {
      setDraft({ ...initialValue });
      setHexInput(initialValue.hex);
    }
  }, [initialValue]);

  const update = <K extends keyof PaintDraft>(key: K, value: PaintDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedHex = normalizeHex(hexInput);
    if (!draft.name.trim() || !normalizedHex) {
      setError('Paint name and a valid 6-digit hex color are required.');
      return;
    }

    setError('');
    onSubmit({
      ...draft,
      name: draft.name.trim(),
      brand: draft.brand?.trim() || undefined,
      notes: draft.notes?.trim() || undefined,
      hex: normalizedHex,
    });

    if (!initialValue) {
      setDraft(emptyDraft);
      setHexInput('#000000');
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Name
          <input
            className="w-full rounded-xl border border-slate-300 px-3 py-2"
            value={draft.name}
            onChange={(event) => update('name', event.target.value)}
            placeholder="Titanium White"
          />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Brand
          <input
            className="w-full rounded-xl border border-slate-300 px-3 py-2"
            value={draft.brand ?? ''}
            onChange={(event) => update('brand', event.target.value)}
            placeholder="Golden"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-[120px,1fr,1fr]">
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Color
          <input
            type="color"
            className="h-11 w-full rounded-xl border border-slate-300 p-1"
            value={normalizeHex(hexInput) ?? '#000000'}
            onChange={(event) => {
              setHexInput(event.target.value);
              update('hex', event.target.value);
            }}
          />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Hex
          <input
            className="w-full rounded-xl border border-slate-300 px-3 py-2"
            value={hexInput}
            onChange={(event) => setHexInput(event.target.value)}
            placeholder="#FFFFFF"
          />
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Opacity
          <select
            className="w-full rounded-xl border border-slate-300 px-3 py-2"
            value={draft.opacity}
            onChange={(event) => update('opacity', event.target.value as Opacity)}
          >
            {opacityOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Temperature bias
          <select
            className="w-full rounded-xl border border-slate-300 px-3 py-2"
            value={draft.temperatureBias}
            onChange={(event) => update('temperatureBias', event.target.value as TemperatureBias)}
          >
            {temperatureOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-700">
          Notes
          <textarea
            className="min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2"
            value={draft.notes ?? ''}
            onChange={(event) => update('notes', event.target.value)}
            placeholder="Optional mixing notes"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-slate-700">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={draft.isEnabled} onChange={(event) => update('isEnabled', event.target.checked)} />
          Enabled for recipes
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={draft.isWhite} onChange={(event) => update('isWhite', event.target.checked)} />
          White paint
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={draft.isBlack} onChange={(event) => update('isBlack', event.target.checked)} />
          Black paint
        </label>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="flex gap-3">
        <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white" type="submit">
          {initialValue ? 'Update paint' : 'Add paint'}
        </button>
        {onCancel ? (
          <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" type="button" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
};
