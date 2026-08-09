import { pool } from './db.js';

// Two intervals [aStart,aEnd) and [bStart,bEnd) overlap when
// aStart < bEnd AND bStart < aEnd.
export async function hasConflict(dentistId, startISO, endISO, ignoreAppointmentId = null) {
  const { rows } = await pool.query(
    `SELECT id FROM appointments
      WHERE dentist_id = $1
        AND status IN ('booked','completed','no_show')
        AND start_time < $2
        AND end_time   > $3
        AND ($4::integer IS NULL OR id != $4)
      LIMIT 1`,
    [dentistId, endISO, startISO, ignoreAppointmentId]
  );
  return rows.length > 0;
}
