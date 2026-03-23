import type { MixStatus } from '../types/models';

const labelMap: Record<MixStatus, string> = {
  'not-mixed': 'Not mixed',
  mixed: 'Mixed',
  adjusted: 'Adjusted',
  'remix-needed': 'Remix needed',
};

const classMap: Record<MixStatus, string> = {
  'not-mixed': 'studio-chip-muted',
  mixed: 'studio-chip-success',
  adjusted: 'studio-chip-info',
  'remix-needed': 'studio-chip-warm',
};

export const MixStatusChip = ({ status }: { status: MixStatus }) => <span className={`studio-chip mix-status-chip ${classMap[status]}`.trim()}>{labelMap[status]}</span>;
