import type { PropsWithChildren } from 'react';

export const Card = ({ children }: PropsWithChildren) => (
  <section className="rounded-[28px] border border-stone-200/90 bg-white/92 p-6 shadow-[0_14px_40px_rgba(41,37,36,0.06)] backdrop-blur-sm">{children}</section>
);
