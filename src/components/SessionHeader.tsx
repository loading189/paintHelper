import type { ReactNode } from 'react';
import { SectionTitle } from './SectionTitle';
import type { PaintingSession } from '../types/models';

export const SessionHeader = ({
  session,
  summary,
  actions,
}: {
  session: PaintingSession;
  summary: Array<{ label: string; value: string | number; note: string }>;
  actions?: ReactNode;
}) => (
  <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr),320px] xl:items-start">
    <div>
      <SectionTitle
        eyebrow="Painting session"
        description={
          session.subject
            ? `Subject: ${session.subject}`
            : 'Build, prepare, and paint from a saved project.'
        }
      >
        {session.title}
      </SectionTitle>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex h-7 items-center rounded-[9px] border border-[rgba(142,166,207,0.22)] px-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[rgba(214,225,245,0.92)]">
          {session.status}
        </span>
        {session.lightingNotes ? (
          <span className="inline-flex h-7 items-center rounded-[9px] border border-[color:var(--border-soft)] px-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
            Lighting noted
          </span>
        ) : null}
        {session.canvasNotes ? (
          <span className="inline-flex h-7 items-center rounded-[9px] border border-[color:var(--border-soft)] px-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
            Canvas noted
          </span>
        ) : null}
      </div>
    </div>

    <div className="grid gap-2.5">
      {summary.map((item) => (
        <div
          key={item.label}
          className="rounded-[14px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)]/84 px-4 py-3"
        >
          <p className="studio-kicker">{item.label}</p>
          <p className="mt-1.5 text-[1.35rem] font-semibold tracking-[-0.05em] text-[color:var(--text-strong)]">
            {item.value}
          </p>
          <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">
            {item.note}
          </p>
        </div>
      ))}
      {actions}
    </div>
  </div>
);