import { Badge } from '@/components/ui/badge';

const LABELS = {
  no_show: 'No-show',
};

export function StatusBadge({ status }) {
  const label = LABELS[status] || status.charAt(0).toUpperCase() + status.slice(1);
  return <Badge variant={status}>{label}</Badge>;
}
