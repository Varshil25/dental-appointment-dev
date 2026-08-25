'use client';

import { useEffect, useState } from 'react';
import { api, fmtTime } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarCheck, CalendarOff } from 'lucide-react';

const dateStr = (d) => d.toISOString().slice(0, 10);
const todayStr = () => dateStr(new Date());
const tomorrowStr = () => dateStr(new Date(Date.now() + 24 * 3600 * 1000));

// Lightweight day-schedule summary for the dentist detail page — booked
// count, free count, and a glanceable slot list. Not a calendar; the full
// calendar view (components/appointments-calendar.jsx) already covers
// that. Reuses the "booked" status color from that calendar/StatusBadge
// (see app/globals.css's --status-booked-* tokens) for visual consistency.
export function TodaysScheduleCard({ dentistId }) {
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!dentistId || !date) return;
    let ignore = false;
    async function loadSchedule() {
      setLoading(true);
      setErr('');
      try {
        const r = await api.dentistSchedule(dentistId, date);
        if (!ignore) setData(r);
      } catch (e) {
        if (!ignore) setErr(e.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadSchedule();
    return () => { ignore = true; };
  }, [dentistId, date]);

  const quick = date === todayStr() ? 'today' : date === tomorrowStr() ? 'tomorrow' : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarCheck className="size-4" /> Today&apos;s Schedule
        </CardTitle>
        <CardDescription>A quick look at one day&apos;s bookings and open slots.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={quick === 'today' ? 'default' : 'outline'} onClick={() => setDate(todayStr())}>
            Today
          </Button>
          <Button size="sm" variant={quick === 'tomorrow' ? 'default' : 'outline'} onClick={() => setDate(tomorrowStr())}>
            Tomorrow
          </Button>
          <Input type="date" className="w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : err ? (
          <p className="text-sm text-destructive">Could not load schedule for this day: {err}</p>
        ) : !data.working ? (
          <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground py-8">
            <CalendarOff className="size-4" />
            {data.reason === 'inactive' ? 'This dentist is inactive.' : 'Not working on this day.'}
          </div>
        ) : (
          <>
            <div className="flex gap-6">
              <div>
                <div className="text-2xl font-bold">{data.booked_count}</div>
                <div className="text-xs text-muted-foreground">
                  appointment{data.booked_count === 1 ? '' : 's'} booked
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold">{data.free_count}</div>
                <div className="text-xs text-muted-foreground">slot{data.free_count === 1 ? '' : 's'} free</div>
              </div>
            </div>

            {data.slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No slots configured for this day.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                {data.slots.map((s) => (
                  <div
                    key={s.start}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm bg-muted/40"
                  >
                    <span className="tabular-nums text-muted-foreground w-16 shrink-0">{fmtTime(s.start)}</span>
                    {s.booked ? (
                      <>
                        <Badge variant="booked" className="shrink-0">Booked</Badge>
                        <span className="truncate">{s.patient_name || 'Patient'}</span>
                      </>
                    ) : (
                      <Badge variant="outline" className="shrink-0">Free</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
