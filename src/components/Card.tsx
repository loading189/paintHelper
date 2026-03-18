import type { PropsWithChildren } from 'react';

export const Card = ({ children }: PropsWithChildren) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-panel">{children}</section>
);
