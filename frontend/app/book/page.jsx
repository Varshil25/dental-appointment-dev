'use client';

import { useEffect, useState } from 'react';
import { api, fmtDateTime, fmtTime } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/use-toast';
import { initials } from '@/lib/initials';
import PhoneInput from '@/components/phone-input';
import { SlotPicker } from '@/components/slot-picker';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { User, Stethoscope, CalendarDays, CheckCircle2, Clock } from 'lucide-react';

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function BookPage() {
  const { user } = useAuth();
  const isDoctor = user?.role === 'doctor';
  const notify = useToast();
  const [patients, setPatients] = useState([]);
  const [dentists, setDentists] = useState([]);
  const [patientId, setPatientId] = useState('');
  const [dentistId, setDentistId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slot, setSlot] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(null);

  // New-patient inline form
  const [patientTab, setPatientTab] = useState('existing');
  const [np, setNp] = useState({ name: '', email: '', phone: '' });
  const [savingPatient, setSavingPatient] = useState(false);

  const loadPatients = () => api.listPatients().then(setPatients);
  useEffect(() => {
    loadPatients();
    api.listDentists().then((all) => {
      // Inactive dentists aren't bookable (appointment-service rejects them
      // anyway) — don't offer them in the picker at all.
      const bookable = all.filter((d) => d.status !== 'inactive');
      setDentists(bookable);
      // A doctor booking from the staff dashboard only ever books for
      // themselves — the underlying POST /api/appointments is public and
      // doesn't enforce this (see gateway/src/server.js's comment on why),
      // but locking the picker keeps the UI honest about what a doctor's
      // account is meant to do.
      if (isDoctor && user.dentist_id) setDentistId(String(user.dentist_id));
      else if (bookable[0]) setDentistId(String(bookable[0].id));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload slots whenever dentist or date changes.
  useEffect(() => {
    if (!dentistId || !date) return;
    let ignore = false;
    async function loadSlots() {
      setSlot(null);
      setSlotsLoading(true);
      try {
        const r = await api.slots(dentistId, date);
        if (!ignore) setSlots(r.slots);
      } catch {
        if (!ignore) setSlots([]);
      } finally {
        if (!ignore) setSlotsLoading(false);
      }
    }
    loadSlots();
    return () => { ignore = true; };
  }, [dentistId, date]);

  async function createPatientInline() {
    if (!np.name || !np.email) return notify('Name and email required', 'err');
    setSavingPatient(true);
    try {
      const p = await api.createPatient(np);
      await loadPatients();
      setPatientId(String(p.id));
      setPatientTab('existing');
      setNp({ name: '', email: '', phone: '' });
      notify(`Added patient ${p.name}`);
    } catch (e) {
      notify(e.message, 'err');
    } finally {
      setSavingPatient(false);
    }
  }

  async function book() {
    if (!patientId) return notify('Choose a patient', 'err');
    if (!slot) return notify('Choose a time slot', 'err');
    setBusy(true);
    try {
      const appt = await api.book({
        patient_id: Number(patientId),
        dentist_id: Number(dentistId),
        start: slot.start,
        end: slot.end,
        reason,
      });
      setConfirmed(appt);
      setSlot(null);
      setReason('');
      // refresh slots so the booked one shows as taken
      api.slots(dentistId, date).then((r) => setSlots(r.slots));
      notify('Appointment booked — confirmation email sent');
    } catch (e) {
      notify(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  const selectedPatient = patients.find((p) => String(p.id) === patientId);
  const selectedDentist = dentists.find((d) => String(d.id) === dentistId);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Book an Appointment</h1>
        <p className="text-muted-foreground">Pick a patient, dentist and an open slot. A confirmation email goes out on booking.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        {/* Left: patient + schedule config */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><User className="size-4" /> Patient</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={patientTab} onValueChange={setPatientTab}>
                <TabsList className="w-full">
                  <TabsTrigger value="existing" className="flex-1">Existing</TabsTrigger>
                  <TabsTrigger value="new" className="flex-1">New patient</TabsTrigger>
                </TabsList>

                <TabsContent value="existing" className="mt-3">
                  <Select value={patientId} onValueChange={setPatientId}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="— select a patient —" /></SelectTrigger>
                    <SelectContent>
                      {patients.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name} · {p.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TabsContent>

                <TabsContent value="new" className="mt-3 space-y-3">
                  <div>
                    <Label>Full name</Label>
                    <Input value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input value={np.email} onChange={(e) => setNp({ ...np, email: e.target.value })} />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <PhoneInput value={np.phone} onChange={(phone) => setNp({ ...np, phone })} />
                  </div>
                  <Button size="sm" className="w-full" disabled={savingPatient} onClick={createPatientInline}>
                    {savingPatient && <Spinner />}
                    {savingPatient ? 'Saving…' : 'Save & select patient'}
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Stethoscope className="size-4" /> Dentist &amp; date</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Dentist</Label>
                <Select value={dentistId} onValueChange={setDentistId} disabled={isDoctor}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {dentists.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>{d.name} — {d.specialty}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date</Label>
                <Input type="date" min={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <Label>Reason for visit</Label>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Cleaning, toothache…" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: slots + live summary */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="size-4" /> Available times</CardTitle>
              <CardDescription>Grey, struck-through slots are already booked — double-booking is structurally prevented.</CardDescription>
            </CardHeader>
            <CardContent>
              {slotsLoading ? (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-8 w-16" />)}
                </div>
              ) : (
                <SlotPicker slots={slots} selected={slot} onSelect={setSlot} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Booking summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="size-9">
                  <AvatarFallback>{selectedPatient ? initials(selectedPatient.name) : '—'}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{selectedPatient?.name || 'No patient selected'}</div>
                  <div className="text-xs text-muted-foreground truncate">{selectedPatient?.email || 'Pick a patient on the left'}</div>
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-3 text-sm">
                <Stethoscope className="size-4 text-muted-foreground shrink-0" />
                <span>{selectedDentist?.name || '—'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Clock className="size-4 text-muted-foreground shrink-0" />
                <span>{slot ? fmtDateTime(slot.start) : 'No time slot selected yet'}</span>
              </div>

              <Button className="w-full mt-2" disabled={busy || !slot || !patientId} onClick={book}>
                {busy && <Spinner />}
                {busy ? 'Booking…' : slot ? `Book ${fmtTime(slot.start)}` : 'Select a slot to book'}
              </Button>

              {confirmed && (
                <div className="text-sm flex items-start gap-2 bg-status-completed-bg text-status-completed-fg border border-status-completed-fg/20 rounded-md p-3">
                  <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                  <span>
                    Booked: {confirmed.patient_name} with {confirmed.dentist_name} on {fmtDateTime(confirmed.start_time)}.
                    Reminders scheduled automatically.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
