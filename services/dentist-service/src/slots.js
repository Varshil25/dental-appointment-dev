// Build the list of bookable slots for one dentist on one calendar day.
// `dateStr` is YYYY-MM-DD interpreted in the server's local timezone.
// `takenIntervals` is [[startMs, endMs], ...] for that dentist/day, fetched
// from appointment-service (the owner of that data).
export function generateSlots(dentist, dateStr, takenIntervals = []) {
  // Bug fix: a zero/negative slot length would never advance the inner
  // loop counter below, spinning forever and hanging the process.
  if (!Number.isFinite(dentist.slot_minutes) || dentist.slot_minutes <= 0) return [];

  const [y, m, d] = dateStr.split('-').map(Number);
  const slots = [];
  const slotMs = dentist.slot_minutes * 60 * 1000;
  const closingMs = new Date(y, m - 1, d, dentist.work_end, 0, 0).getTime();
  const now = Date.now();

  for (let hour = dentist.work_start; hour < dentist.work_end; hour++) {
    for (let min = 0; min < 60; min += dentist.slot_minutes) {
      const start = new Date(y, m - 1, d, hour, min, 0);
      const startMs = start.getTime();
      const endMs = startMs + slotMs;
      // Bug fix: compare directly against the closing timestamp instead of
      // getHours()/getMinutes(), which let a slot ending exactly on or just
      // past closing (e.g. 17:45-18:30 when work_end=18) slip through.
      if (endMs > closingMs) continue;

      const overlaps = takenIntervals.some(([ts, te]) => startMs < te && ts < endMs);
      slots.push({
        start: start.toISOString(),
        end: new Date(endMs).toISOString(),
        available: !overlaps && startMs > now,
      });
    }
  }
  return slots;
}
