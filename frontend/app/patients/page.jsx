'use client';

import { useEffect, useState } from 'react';
import { api, fmtDateTime } from '@/lib/api';
import { useToast } from '@/lib/use-toast';
import PhoneInput from '@/components/phone-input';
import { StatusBadge } from '@/components/status-badge';
import { TableSkeletonRows } from '@/components/table-skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';

export default function PatientsPage() {
  const notify = useToast();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [openingId, setOpeningId] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', dob: '', notes: '' });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = (query = '') => api.listPatients(query).then(setPatients).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const open = (id) => {
    setOpeningId(id);
    api.getPatient(id).then(setSelected).finally(() => setOpeningId(null));
  };

  async function create() {
    if (!form.name || !form.email) return notify('Name and email required', 'err');
    setSaving(true);
    try {
      await api.createPatient(form);
      setForm({ name: '', email: '', phone: '', dob: '', notes: '' });
      setShowForm(false);
      load(q);
      notify('Patient added');
    } catch (e) { notify(e.message, 'err'); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Patient Records</h1>
        <p className="text-muted-foreground">Search patients, view their appointment history, and add new records.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Search name, email, phone…"
                value={q}
                onChange={(e) => { setQ(e.target.value); load(e.target.value); }}
              />
              <Button variant="outline" className="shrink-0" onClick={() => setShowForm(!showForm)}>
                {showForm ? 'Close' : '+ New'}
              </Button>
            </div>

            {showForm && (
              <div className="mt-4 pt-4 border-t space-y-3">
                <div>
                  <Label>Full name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Email</Label>
                    <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <PhoneInput value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
                  </div>
                </div>
                <div>
                  <Label>Date of birth</Label>
                  <Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <Button onClick={create} disabled={saving}>
                  {saving && <Spinner />}
                  {saving ? 'Saving…' : 'Save patient'}
                </Button>
              </div>
            )}

            <Table className="mt-4">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableSkeletonRows rows={5} cols={3} />}
                {!loading && patients.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.email}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" disabled={openingId === p.id} onClick={() => open(p.id)}>
                        {openingId === p.id && <Spinner />}
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && patients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No patients found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            {!selected ? (
              <p className="text-center text-muted-foreground py-8">Select a patient to see their record and history.</p>
            ) : (
              <>
                <h2 className="text-lg font-semibold">{selected.name}</h2>
                <p className="text-muted-foreground m-0">{selected.email} · {selected.phone || 'no phone'}</p>
                <Table className="mt-3">
                  <TableBody>
                    {selected.dob && (
                      <TableRow>
                        <TableCell className="text-muted-foreground">Date of birth</TableCell>
                        <TableCell>{selected.dob}</TableCell>
                      </TableRow>
                    )}
                    {selected.notes && (
                      <TableRow>
                        <TableCell className="text-muted-foreground">Notes</TableCell>
                        <TableCell>{selected.notes}</TableCell>
                      </TableRow>
                    )}
                    <TableRow>
                      <TableCell className="text-muted-foreground">Total visits</TableCell>
                      <TableCell>{selected.appointments.length}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                <h3 className="mt-4 font-semibold">Appointment history</h3>
                {selected.appointments.length === 0 ? (
                  <p className="text-muted-foreground">No appointments yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Dentist</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selected.appointments.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>{fmtDateTime(a.start_time)}</TableCell>
                          <TableCell>{a.dentist_name}</TableCell>
                          <TableCell><StatusBadge status={a.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
