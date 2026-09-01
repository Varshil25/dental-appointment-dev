import { Badge } from '@/components/ui/badge';

// Reuses the appointment-status badge color tokens (see status-badge.jsx)
// rather than adding new ones: paid maps to the same green as "completed",
// unpaid to the same amber as "no-show" (needs attention), cancelled to
// the same red as appointment cancellations.
const VARIANTS = { paid: 'completed', unpaid: 'no_show', cancelled: 'cancelled' };
const LABELS = { paid: 'Paid', unpaid: 'Unpaid', cancelled: 'Cancelled' };

export function InvoiceStatusBadge({ status }) {
  return <Badge variant={VARIANTS[status] || 'secondary'}>{LABELS[status] || status}</Badge>;
}
