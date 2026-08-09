import {
  appointmentSummary,
  perDentistSummary,
  appointmentTimeseries,
  listDentists,
  remindersSummary,
  patientsCount,
} from './clients/index.js';
import { cached } from './cache.js';

// report-service owns no data of its own — it recomposes the exact
// response shape the monolith's single-query /reports/summary used to
// return, by calling each service that owns a piece of it. Unlike
// patient-service's history composition, this fails *fast*: a wrong or
// partial dashboard number is worse than a visible error, since these
// numbers drive clinic decisions.
//
// This is the single most expensive operation in the whole backend (5
// parallel HTTP calls + composition), and report-service does no writes
// of its own, so it's the highest-value cache target: a cache hit turns
// this into a single Redis GET instead of a full fan-out.
export async function buildSummary({ from, to } = {}) {
  const key = `summary:${from || ''}:${to || ''}`;
  return cached(key, 20, () => buildSummaryUncached({ from, to }));
}

async function buildSummaryUncached({ from, to } = {}) {
  const [summary, perDentistRaw, timeseries, dentists, reminders, patients] = await Promise.all([
    appointmentSummary(from, to),
    perDentistSummary(from, to),
    appointmentTimeseries(14),
    listDentists(),
    remindersSummary(),
    patientsCount(),
  ]);

  const { counts, total, upcoming } = summary;
  // No-show / cancellation rates are measured against appointments that
  // were actually scheduled (still-upcoming-and-booked would skew them).
  const finished = counts.completed + counts.no_show + counts.cancelled;
  const rate = (n) => (finished ? +((n / finished) * 100).toFixed(1) : 0);

  // Left-join every dentist (so zero-appointment dentists still appear,
  // matching the monolith's LEFT JOIN) with their per-dentist counts.
  const byDentistId = new Map(perDentistRaw.map((r) => [r.dentistId, r]));
  const perDentist = dentists
    .map((d) => {
      const r = byDentistId.get(d.id) || { kept: 0, noShows: 0, cancelled: 0 };
      return { id: d.id, name: d.name, kept: r.kept, no_shows: r.noShows, cancelled: r.cancelled };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    total,
    counts,
    noShowRate: rate(counts.no_show),
    cancellationRate: rate(counts.cancelled),
    upcoming,
    remindersSent: reminders.sent,
    patients: patients.n,
    perDentist,
    today: timeseries.today,
    thisMonth: timeseries.thisMonth,
    dailySeries: timeseries.series,
  };
}
