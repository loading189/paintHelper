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
  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),360px] xl:items-start">
    <div>
      <SectionTitle eyebrow="Painting session" description={session.subject ? `Subject: ${session.subject}` : 'Preparation, target planning, and active painting now live inside a reusable local session.'}>
        {session.title}
      </SectionTitle>
      {session.notes ? <p className="mt-4 max-w-3xl text-sm leading-7 text-[color:var(--text-muted)]">{session.notes}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="studio-chip studio-chip-info">{session.status}</span>
        {session.lightingNotes ? <span className="studio-chip">Lighting noted</span> : null}
        {session.canvasNotes ? <span className="studio-chip">Canvas noted</span> : null}
      </div>
    </div>
    <div className="space-y-3">
      {summary.map((item) => (
        <div key={item.label} className="studio-metric">
          <p className="studio-eyebrow">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">{item.value}</p>
          <p className="mt-1 text-sm text-[color:var(--text-muted)]">{item.note}</p>
        </div>
      ))}
      {actions}
    </div>
  </div>
);
