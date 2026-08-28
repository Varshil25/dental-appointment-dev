import { useEffect, useMemo, useState } from 'react';
import { api, fmtDateTime } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { initials } from '@/lib/initials';
import { useAppointmentActions } from '@/hooks/use-appointment-actions';
import { StatusBadge } from '@/components/status-badge';
import { RescheduleDialog } from '@/components/reschedule-dialog';
import { AppointmentDetailDialog } from '@/components/appointment-detail-dialog';
import { AppointmentsCalendar } from '@/components/appointments-calendar';
import { TableSkeletonRows } from '@/components/table-skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { MoreHorizontal, CalendarClock, CheckCircle2, UserX, XCircle, PlusCircle, Search, TriangleAlert } from 'lucide-react';

const FILTERS = ['all', 'booked', 'completed', 'cancelled', 'no_show'];

export default function AppointmentsPage() {
  const { user } = useAuth();
  // Doctors only ever see their own appointments — the gateway enforces
  // this server-side regardless of what's requested (see
  // scopeAppointmentsList in services/gateway/src/auth.js), but passing it
  // here too keeps the UI honest and avoids relying on that as a surprise.
  const dentistId = user?.role === 'doctor' ? user.dentist_id : undefined;

  const [view, setView] = useState('list'); // 'list' | 'calendar'
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [appts, setAppts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailAppt, setDetailAppt] = useState(null);

  const [calendarRefresh, setCalendarRefresh] = useState(0);

  const load = () =>
    api.listAppointments({ ...(filter === 'all' ? {} : { status: filter }), dentistId }).then(setAppts).finally(() => setLoading(false));
  useEffect(() => { load(); }, [filter, dentistId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refreshes both views after a mutation — the list's own filtered fetch
  // and the calendar's range-bounded fetch are independent, so both need
  // to be told to reload.
  const refreshAll = () => { load(); setCalendarRefresh((n) => n + 1); };

  // Shared reschedule/cancel/status-change logic — used by both the list
  // view's row menu and the calendar view's event-click detail dialog, so
  // there's exactly one <RescheduleDialog/> and one set of handlers.
  const actions = useAppointmentActions(refreshAll);
  const { modal, setModal, pending, act, cancel } = actions;

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return appts;
    return appts.filter(
      (a) => a.patient_name?.toLowerCase().includes(needle) || a.dentist_name?.toLowerCase().includes(needle)
    );
  }, [appts, q]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Appointments</h1>
        <p className="text-muted-foreground">Manage bookings: reschedule, cancel, record outcomes, and add follow-ups.</p>
      </div>

      <Tabs value={view} onValueChange={setView} className="mb-4 gap-4">
        <TabsList>
          <TabsTrigger value="list">List view</TabsTrigger>
          <TabsTrigger value="calendar">Calendar view</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <AppointmentsCalendar refreshKey={calendarRefresh} onSelectAppointment={setDetailAppt} dentistId={dentistId} />
        </TabsContent>

        <TabsContent value="list">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              className={cn('rounded-full capitalize', filter === f && 'pointer-events-none')}
              onClick={() => setFilter(f)}
            >
              {f.replace('_', '-')}
            </Button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search patient or dentist…" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>When</TableHead>
                <TableHead>Dentist</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableSkeletonRows rows={6} cols={6} />}
              {!loading && visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {q ? 'No appointments match your search.' : 'No appointments in this view.'}
                  </TableCell>
                </TableRow>
              )}
              {!loading && visible.map((a) => {
                const rowBusy = pending?.id === a.id;
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="size-8 shrink-0">
                          <AvatarFallback className="text-xs">{initials(a.patient_name)}</AvatarFallback>
                        </Avatar>
                        <span className="truncate">{a.patient_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {fmtDateTime(a.start_time)}
                      {a.follow_up_of ? <span className="text-muted-foreground"> · follow-up</span> : ''}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {a.dentist_name}
                        {a.status === 'booked' && a.dentist_status === 'inactive' && (
                          <Tooltip>
                            <TooltipTrigger>
                              <TriangleAlert className="size-3.5 text-status-cancelled-fg" />
                            </TooltipTrigger>
                            <TooltipContent>Dentist is now inactive</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{a.reason || '—'}</TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" disabled={rowBusy} />}>
                          {rowBusy ? <Spinner /> : <MoreHorizontal className="size-4" />}
                          <span className="sr-only">Actions</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {a.status === 'booked' && (
                            <>
                              <DropdownMenuItem onClick={() => setModal({ appt: a, mode: 'reschedule' })}>
                                <CalendarClock /> Reschedule
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => act(a.id, 'complete', () => api.setStatus(a.id, 'completed'), 'Marked completed')}>
                                <CheckCircle2 /> Mark completed
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => act(a.id, 'no_show', () => api.setStatus(a.id, 'no_show'), 'Marked no-show')}>
                                <UserX /> Mark no-show
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => cancel(a)}>
                                <XCircle /> Cancel
                              </DropdownMenuItem>
                            </>
                          )}
                          {a.status === 'completed' && (
                            <DropdownMenuItem onClick={() => setModal({ appt: a, mode: 'follow-up' })}>
                              <PlusCircle /> Book follow-up
                            </DropdownMenuItem>
                          )}
                          {a.status !== 'booked' && a.status !== 'completed' && (
                            <DropdownMenuItem disabled>No actions available</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>

      <RescheduleDialog
        appt={modal?.appt}
        mode={modal?.mode}
        open={!!modal}
        onOpenChange={(o) => !o && setModal(null)}
        onDone={refreshAll}
      />

      <AppointmentDetailDialog
        appt={detailAppt}
        open={!!detailAppt}
        onOpenChange={(o) => !o && setDetailAppt(null)}
        actions={actions}
      />
    </div>
  );
}
