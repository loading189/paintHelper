import type { PropsWithChildren } from 'react';

export const SectionTitle = ({ children }: PropsWithChildren) => (
  <h2 className="text-xl font-semibold tracking-tight text-stone-950">{children}</h2>
);
