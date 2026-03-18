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
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr),280px]">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-[color:var(--text-body)]">
            <span className="mb-2 block text-[13px] font-semibold tracking-[-0.01em] text-[color:var(--text-strong)]">Paint name</span>
            <input
              className="studio-input"
              value={draft.name}
              onChange={(event) => update('name', event.target.value)}
              placeholder="Titanium White"
            />
          </label>
          <label className="text-sm font-medium text-[color:var(--text-body)]">
            <span className="mb-2 block text-[13px] font-semibold tracking-[-0.01em] text-[color:var(--text-strong)]">Brand</span>
            <input
              className="studio-input"
              value={draft.brand ?? ''}
              onChange={(event) => update('brand', event.target.value)}
              placeholder="Golden"
            />
          </label>
        </div>

        <div className="rounded-[28px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] p-4">
          <p className="studio-eyebrow">Color preview</p>
          <div className="swatch-well mt-3 rounded-[24px] border border-[color:var(--border-strong)] bg-[color:var(--surface-2)] p-3">
            <div className="h-20 rounded-[18px] border border-black/10" style={{ backgroundColor: normalizeHex(hexInput) ?? '#000000' }} />
          </div>
          <p className="mt-3 text-sm font-semibold text-[color:var(--text-strong)]">{normalizeHex(hexInput) ?? 'Invalid hex'}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[132px,minmax(0,1fr),220px,220px]">
        <label className="text-sm font-medium text-[color:var(--text-body)]">
          <span className="mb-2 block text-[13px] font-semibold tracking-[-0.01em] text-[color:var(--text-strong)]">Picker</span>
          <input
            type="color"
            className="h-[58px] w-full rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] p-1.5"
            value={normalizeHex(hexInput) ?? '#000000'}
            onChange={(event) => {
              setHexInput(event.target.value);
              update('hex', event.target.value);
            }}
          />
        </label>
        <label className="text-sm font-medium text-[color:var(--text-body)]">
          <span className="mb-2 block text-[13px] font-semibold tracking-[-0.01em] text-[color:var(--text-strong)]">Hex</span>
          <input className="studio-input" value={hexInput} onChange={(event) => setHexInput(event.target.value)} placeholder="#FFFFFF" />
        </label>
        <label className="text-sm font-medium text-[color:var(--text-body)]">
          <span className="mb-2 block text-[13px] font-semibold tracking-[-0.01em] text-[color:var(--text-strong)]">Opacity</span>
          <select className="studio-select" value={draft.opacity} onChange={(event) => update('opacity', event.target.value as Opacity)}>
            {opacityOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-[color:var(--text-body)]">
          <span className="mb-2 block text-[13px] font-semibold tracking-[-0.01em] text-[color:var(--text-strong)]">Temperature bias</span>
          <select className="studio-select" value={draft.temperatureBias} onChange={(event) => update('temperatureBias', event.target.value as TemperatureBias)}>
            {temperatureOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm font-medium text-[color:var(--text-body)]">
        <span className="mb-2 block text-[13px] font-semibold tracking-[-0.01em] text-[color:var(--text-strong)]">Studio notes</span>
        <textarea
          className="studio-textarea min-h-28"
          value={draft.notes ?? ''}
          onChange={(event) => update('notes', event.target.value)}
          placeholder="Optional mixing notes, undertone reminders, or tube behavior observations"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          { label: 'Enabled for recipes', checked: draft.isEnabled, key: 'isEnabled' as const },
          { label: 'White paint', checked: draft.isWhite, key: 'isWhite' as const },
          { label: 'Black paint', checked: draft.isBlack, key: 'isBlack' as const },
        ].map((item) => (
          <label key={item.label} className="flex items-start justify-between gap-4 rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-4 py-4 text-sm text-[color:var(--text-body)]">
            <span className="font-medium text-[color:var(--text-strong)]">{item.label}</span>
            <input type="checkbox" checked={item.checked} onChange={(event) => update(item.key, event.target.checked as PaintDraft[typeof item.key])} className="mt-1 h-4 w-4" />
          </label>
        ))}
      </div>

      {error ? <p className="rounded-[22px] border border-[rgba(146,92,92,0.18)] bg-[rgba(146,92,92,0.08)] px-4 py-3 text-sm text-[#7f514f]">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button className="studio-button studio-button-primary" type="submit">
          {initialValue ? 'Update paint' : 'Add paint'}
        </button>
        {onCancel ? (
          <button className="studio-button studio-button-secondary" type="button" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
};
