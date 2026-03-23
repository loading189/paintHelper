import type { MixStatus } from '../types/models';

const labelMap: Record<MixStatus, string> = {
  'not-mixed': 'Not mixed',
  mixed: 'Mixed',
  adjusted: 'Adjusted',
  'remix-needed': 'Remix needed',
};

const toneMap: Record<MixStatus, string> = {
  'not-mixed': 'studio-status-muted',
  mixed: 'studio-status-success',
  adjusted: 'studio-status-info',
  'remix-needed': 'studio-status-warn',
};

export const MixStatusChip = ({ status }: { status: MixStatus }) => (
  <span className={`studio-status ${toneMap[status]}`.trim()}>
    <span className="studio-status-dot" />
    {labelMap[status]}
  </span>
);