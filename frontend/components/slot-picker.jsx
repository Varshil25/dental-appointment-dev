import { Button } from '@/components/ui/button';
import { fmtTime } from '@/lib/api';

// Shared slot-grid: used by the Book page (step 3) and the reschedule/
// follow-up dialog. `slots` is the array from GET /dentists/:id/slots.
export function SlotPicker({ slots, selected, onSelect }) {
  if (slots.length === 0) {
    return <p className="text-muted-foreground text-sm">No slots for this day (closed or fully booked).</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {slots.map((s) => (
        <Button
          key={s.start}
          type="button"
          variant={selected?.start === s.start ? 'default' : 'outline'}
          size="sm"
          disabled={!s.available}
          className={!s.available ? 'line-through opacity-50' : ''}
          onClick={() => onSelect(s)}
        >
          {fmtTime(s.start)}
        </Button>
      ))}
    </div>
  );
}
