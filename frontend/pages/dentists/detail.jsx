import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { api, fmtDateTime } from '@/lib/api';
import { useToast } from '@/lib/use-toast';
import { DAY_LABELS } from '@/lib/days';
import PhoneInput from '@/components/phone-input';
import { StatusBadge } from '@/components/status-badge';
import { DeactivateDentistDialog } from '@/components/deactivate-dentist-dialog';
import { TodaysScheduleCard } from '@/components/todays-schedule-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, User, CalendarClock, TriangleAlert } from 'lucide-react';

// Display order Mon..Sun (the brief's requested grid order) — storage
// stays Sun=0..Sat=6 (JS Date#getDay()) to match the backend.
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function DentistDetailPage() {
  const router = useRouter();
  const id = router.query.id;
  const notify = useToast();

  const [dentist, setDentist] = useState(null);
  const [form, setForm] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [days, setDays] = useState(null); // [{day_of_week, is_available, work_start, work_end}, ...]
  const [savingAvailability, setSavingAvailability] = useState(false);

  const [upcoming, setUpcoming] = useState([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);

  const [conflict, setConflict] = useState(null); // { count, appointments } from a 409

  const loadDentist = () => api.getDentist(id).then((d) => { setDentist(d); setForm(d); });
  const loadAvailability = () => api.getDentistAvailability(id).then((r) => setDays(r.days));
  const loadUpcoming = () =>
    api.listAppointments({ dentistId: id, status: 'booked' })
      .then(setUpcoming)
      .finally(() => setLoadingUpcoming(false));

  useEffect(() => {
    if (!id) return;
    loadDentist();
    loadAvailability();
    loadUpcoming();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveProfile() {
    if (!form.name) return notify('Name is required', 'err');
    setSavingProfile(true);
    try {
      const updated = await api.updateDentist(id, form);
      setDentist(updated);
      setForm(updated);
      notify('Profile updated');
    } catch (e) {
      if (e.status === 409 && e.data?.conflict === 'future_appointments') {
        setConflict({ count: e.data.count, appointments: e.data.appointments });
      } else {
        notify(e.message, 'err');
      }
    } finally {
      setSavingProfile(false);
    }
  }

  function onDeactivateResolved(updated) {
    setDentist(updated);
    setForm(updated);
    loadUpcoming();
  }

  function updateDay(day_of_week, patch) {
    setDays((prev) => prev.map((d) => (d.day_of_week === day_of_week ? { ...d, ...patch } : d)));
  }

  async function saveAvailability() {
    setSavingAvailability(true);
    try {
      const r = await api.updateDentistAvailability(id, days);
      setDays(r.days);
      notify('Availability updated');
    } catch (e) {
      notify(e.message, 'err');
    } finally {
      setSavingAvailability(false);
    }
  }

  if (!id) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-3">No dentist selected.</p>
        <Button variant="outline" onClick={() => router.push('/dentists')}>Back to dentists</Button>
      </div>
    );
  }

  if (!dentist || !form) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.push('/dentists')}>
        <ArrowLeft /> Back to dentists
      </Button>

      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold">{dentist.name}</h1>
        <Badge variant={dentist.status === 'active' ? 'completed' : 'cancelled'} className="capitalize">
          {dentist.status}
        </Badge>
      </div>

      <div className="mb-4">
        <TodaysScheduleCard dentistId={id} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><User className="size-4" /> Profile</CardTitle>
            <CardDescription>Editable — changes apply immediately, including to future slot generation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Full name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Specialty</Label>
                <Input value={form.specialty || ''} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <PhoneInput value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
            </div>
            <div>
              <Label>Default slot length (minutes)</Label>
              <Input type="number" min={5} step={5} value={form.slot_minutes}
                onChange={(e) => setForm({ ...form, slot_minutes: Number(e.target.value) })} />
            </div>
            <Button disabled={savingProfile} onClick={saveProfile}>
              {savingProfile && <Spinner />}
              Save profile
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="size-4" /> Weekly availability</CardTitle>
            <CardDescription>Toggle a day off, or set different hours per day.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {!days ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <>
                {DISPLAY_ORDER.map((dow) => {
                  const d = days.find((x) => x.day_of_week === dow);
                  if (!d) return null;
                  return (
                    <div key={dow} className="flex items-center gap-3 py-1.5 border-b last:border-0">
                      <Switch
                        checked={d.is_available}
                        onCheckedChange={(checked) => updateDay(dow, { is_available: checked })}
                      />
                      <span className="w-20 text-sm shrink-0">{DAY_LABELS[dow]}</span>
                      {d.is_available ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <Input
                            type="number" min={0} max={23} className="w-16 h-7"
                            value={d.work_start}
                            onChange={(e) => updateDay(dow, { work_start: Number(e.target.value) })}
                          />
                          <span className="text-muted-foreground">to</span>
                          <Input
                            type="number" min={1} max={24} className="w-16 h-7"
                            value={d.work_end}
                            onChange={(e) => updateDay(dow, { work_end: Number(e.target.value) })}
                          />
                          <span className="text-xs text-muted-foreground">(24h)</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Off</span>
                      )}
                    </div>
                  );
                })}
                <Button className="mt-2" disabled={savingAvailability} onClick={saveAvailability}>
                  {savingAvailability && <Spinner />}
                  Save availability
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Upcoming appointments</CardTitle>
            {dentist.status === 'inactive' && !loadingUpcoming && upcoming.length > 0 && (
              <CardDescription className="flex items-center gap-1.5 text-status-cancelled-fg">
                <TriangleAlert className="size-3.5" />
                This dentist is inactive — these were kept and won&apos;t be auto-cancelled.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingUpcoming && (
                  <TableRow><TableCell colSpan={4}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                )}
                {!loadingUpcoming && upcoming.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No upcoming appointments.
                    </TableCell>
                  </TableRow>
                )}
                {!loadingUpcoming && upcoming.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.patient_name}</TableCell>
                    <TableCell>{fmtDateTime(a.start_time)}</TableCell>
                    <TableCell className="text-muted-foreground">{a.reason || '—'}</TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <DeactivateDentistDialog
        dentistId={id}
        dentistName={dentist.name}
        pendingBody={form}
        conflict={conflict}
        onOpenChange={(open) => {
          if (!open) {
            // Dialog dismissed without a resolution ("don't change status")
            // — the Select still shows "inactive" locally, so put it back
            // to what's actually saved rather than leaving a lie on screen.
            setForm((f) => ({ ...f, status: dentist.status }));
            setConflict(null);
          }
        }}
        onDone={onDeactivateResolved}
      />
    </div>
  );
}
