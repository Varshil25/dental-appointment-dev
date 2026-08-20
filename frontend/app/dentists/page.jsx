'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useToast } from '@/lib/use-toast';
import { initials } from '@/lib/initials';
import { cn } from '@/lib/utils';
import PhoneInput from '@/components/phone-input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarDays, Mail, Phone, Plus } from 'lucide-react';

const EMPTY_FORM = { name: '', specialty: '', email: '', phone: '', work_start: 9, work_end: 17, slot_minutes: 30, status: 'active' };

export default function DentistsPage() {
  const notify = useToast();
  const [dentists, setDentists] = useState([]);
  const [todayCounts, setTodayCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = () => api.listDentists().then(setDentists).finally(() => setLoading(false));

  useEffect(() => {
    load();
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    api.listAppointments({ from: start.toISOString(), to: end.toISOString() }).then((appts) => {
      const counts = {};
      for (const a of appts) counts[a.dentist_id] = (counts[a.dentist_id] || 0) + 1;
      setTodayCounts(counts);
    });
  }, []);

  async function create() {
    if (!form.name) return notify('Name is required', 'err');
    setSaving(true);
    try {
      await api.createDentist(form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
      notify('Dentist added');
    } catch (e) {
      notify(e.message, 'err');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dentists</h1>
          <p className="text-muted-foreground">Manage clinic dentists, their profiles, and weekly availability.</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus /> Add dentist
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading &&
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent><Skeleton className="h-32 w-full" /></CardContent></Card>
          ))}

        {!loading && dentists.length === 0 && (
          <p className="text-muted-foreground col-span-full text-center py-8">No dentists yet — add one to get started.</p>
        )}

        {!loading &&
          dentists.map((d) => (
            <Link key={d.id} href={`/dentists/detail?id=${d.id}`}>
              <Card className={cn(
                'h-full hover:bg-muted/50 transition-colors cursor-pointer',
                d.status === 'inactive' && 'opacity-60 grayscale-[40%]'
              )}>
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar className="size-9 shrink-0">
                        <AvatarFallback>{initials(d.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{d.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{d.specialty || 'General'}</div>
                      </div>
                    </div>
                    <Badge variant={d.status === 'active' ? 'completed' : 'cancelled'} className="capitalize shrink-0">
                      {d.status}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-sm text-muted-foreground">
                    {d.email && (
                      <div className="flex items-center gap-2 truncate"><Mail className="size-3.5 shrink-0" /> {d.email}</div>
                    )}
                    {d.phone && (
                      <div className="flex items-center gap-2 truncate"><Phone className="size-3.5 shrink-0" /> {d.phone}</div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm pt-1 border-t">
                    <CalendarDays className="size-3.5 text-muted-foreground shrink-0" />
                    <span>{todayCounts[d.id] || 0} appointment{todayCounts[d.id] === 1 ? '' : 's'} today</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add dentist</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Full name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Specialty</Label>
                <Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
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
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <PhoneInput value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Start (hour)</Label>
                <Input type="number" min={0} max={23} value={form.work_start}
                  onChange={(e) => setForm({ ...form, work_start: Number(e.target.value) })} />
              </div>
              <div>
                <Label>End (hour)</Label>
                <Input type="number" min={1} max={24} value={form.work_end}
                  onChange={(e) => setForm({ ...form, work_end: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Slot (min)</Label>
                <Input type="number" min={5} step={5} value={form.slot_minutes}
                  onChange={(e) => setForm({ ...form, slot_minutes: Number(e.target.value) })} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              These hours become the default weekly schedule (every day) — fine-tune per day from the dentist&apos;s profile after adding.
            </p>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button disabled={saving} onClick={create}>
              {saving && <Spinner />}
              Save dentist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
