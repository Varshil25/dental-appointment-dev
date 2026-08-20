'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, startOfDay, endOfDay, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { api, fmtTime } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './appointments-calendar.css';

// Force Monday-start weeks (the brief calls for Mon–Sun week columns),
// overriding date-fns' en-US default of Sunday.
const mondayLocale = { ...enUS, options: { ...enUS.options, weekStartsOn: 1 } };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { 'en-US': mondayLocale },
});

const VIEWS = ['day', 'week', 'month'];

const STATUS_VARS = {
  booked: ['--status-booked-bg', '--status-booked-fg'],
  completed: ['--status-completed-bg', '--status-completed-fg'],
  cancelled: ['--status-cancelled-bg', '--status-cancelled-fg'],
  no_show: ['--status-noshow-bg', '--status-noshow-fg'],
};

function eventPropGetter(event) {
  const [bgVar, fgVar] = STATUS_VARS[event.resource.status] || STATUS_VARS.booked;
  const flagged = event.resource.status === 'booked' && event.resource.dentist_status === 'inactive';
  return {
    className: cn('rounded-md px-1.5 text-xs font-medium', flagged && 'ring-2 ring-inset ring-status-cancelled-fg/70'),
    style: { backgroundColor: `var(${bgVar})`, color: `var(${fgVar})` },
  };
}

// Fetch bounds for the visible range — padded to full Mon–Sun weeks in
// month view so leading/trailing days (from adjacent months, shown in the
// grid) also get their appointments loaded.
function rangeFor(date, view) {
  if (view === 'day') return { from: startOfDay(date), to: endOfDay(date) };
  if (view === 'week') return { from: startOfWeek(date, { weekStartsOn: 1 }), to: endOfWeek(date, { weekStartsOn: 1 }) };
  return { from: startOfWeek(startOfMonth(date), { weekStartsOn: 1 }), to: endOfWeek(endOfMonth(date), { weekStartsOn: 1 }) };
}

function CalendarToolbar({ label, view, views, onNavigate, onView }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={() => onNavigate('TODAY')}>Today</Button>
        <Button variant="ghost" size="icon-sm" onClick={() => onNavigate('PREV')}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => onNavigate('NEXT')}>
          <ChevronRight className="size-4" />
        </Button>
        <span className="ml-2 text-sm font-medium">{label}</span>
      </div>
      <ToggleGroup variant="outline" size="sm" value={[view]} onValueChange={(vals) => vals[0] && onView(vals[0])}>
        {views.map((v) => (
          <ToggleGroupItem key={v} value={v} className="capitalize">{v}</ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

// Calendar view for the Appointments page. Fetches with the same
// GET /api/appointments endpoint the list view uses (`from`/`to` bounded
// to the visible range) — no new backend endpoint.
export function AppointmentsCalendar({ onSelectAppointment, refreshKey, dentistId }) {
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState('month');
  const [appts, setAppts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState({ min: 8, max: 19 });

  useEffect(() => {
    api.listDentists().then((dentists) => {
      if (!dentists?.length) return;
      setHours({
        min: Math.min(...dentists.map((d) => d.work_start)),
        max: Math.max(...dentists.map((d) => d.work_end)),
      });
    });
  }, []);

  useEffect(() => {
    const { from, to } = rangeFor(date, view);
    api
      .listAppointments({ from: from.toISOString(), to: to.toISOString(), dentistId })
      .then(setAppts)
      .finally(() => setLoading(false));
  }, [date, view, refreshKey, dentistId]);

  const events = useMemo(
    () =>
      appts.map((a) => ({
        id: a.id,
        title:
          a.status === 'booked' && a.dentist_status === 'inactive'
            ? `⚠ ${fmtTime(a.start_time)} ${a.patient_name}`
            : `${fmtTime(a.start_time)} ${a.patient_name}`,
        start: new Date(a.start_time),
        end: new Date(a.end_time),
        resource: a,
      })),
    [appts]
  );

  const minTime = useMemo(() => new Date(0, 0, 0, hours.min, 0), [hours.min]);
  const maxTime = useMemo(() => new Date(0, 0, 0, hours.max, 0), [hours.max]);

  return (
    <Card>
      <CardContent className="relative">
        {loading && (
          <div className="absolute right-4 top-4 z-10">
            <Spinner />
          </div>
        )}
        <BigCalendar
          localizer={localizer}
          date={date}
          view={view}
          views={VIEWS}
          onNavigate={setDate}
          onView={setView}
          onDrillDown={(drillDate) => { setDate(drillDate); setView('day'); }}
          events={events}
          startAccessor="start"
          endAccessor="end"
          min={minTime}
          max={maxTime}
          step={30}
          timeslots={2}
          eventPropGetter={eventPropGetter}
          onSelectEvent={(event) => onSelectAppointment(event.resource)}
          popup
          style={{ height: 720 }}
          components={{ toolbar: CalendarToolbar }}
        />
      </CardContent>
    </Card>
  );
}
