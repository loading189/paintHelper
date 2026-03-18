import type { PropsWithChildren } from 'react';

export const SectionTitle = ({ children }: PropsWithChildren) => (
  <h2 className="text-lg font-semibold text-slate-900">{children}</h2>
);
