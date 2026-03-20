import type { MixStatus } from '../../types/models';

const statusLabel: Record<MixStatus, string> = {
  'not-mixed': 'Not mixed',
  mixed: 'Mixed',
  adjusted: 'Adjusted',
  'remix-needed': 'Remix needed',
};

export const MixStatusChip = ({ status }: { status: MixStatus }) => (
  <span className={`mix-status-chip mix-status-${status}`}>{statusLabel[status]}</span>
);
