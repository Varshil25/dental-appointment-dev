import { useEffect, useState } from 'react';
import { api, fmtDateTime } from '@/lib/api';
import { useToast } from '@/lib/use-toast';
import { StatusBadge } from '@/components/status-badge';
import { TableSkeletonRows } from '@/components/table-skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Mail, MessageSquare } from 'lucide-react';

export default function RemindersPage() {
  const notify = useToast();
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = () => api.listReminders().then(setReminders).finally(() => setLoading(false));
  useEffect(() => { load(); api.health().then(setHealth); }, []);

  async function send(id) {
    setBusyId(id);
    try {
      const r = await api.sendReminder(id);
      notify(r.ok ? 'Reminder sent' : `Failed: ${r.detail}`, r.ok ? 'ok' : 'err');
      load();
    } catch (e) { notify(e.message, 'err'); }
    finally { setBusyId(null); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Reminder Log</h1>
        <p className="text-muted-foreground">
          Automated email and SMS reminders. The scheduler sends each one at its due time; you can also send now.
        </p>
      </div>

      {health && health.reminderOffsetsHours?.length > 0 && (
        <div className="text-sm bg-accent text-accent-foreground border border-accent rounded-md p-3">
          Reminders are scheduled <strong>{health.reminderOffsetsHours.join('h and ')}h</strong> before each appointment.
          A background job checks for due reminders every minute and emails patients automatically.
        </div>
      )}

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scheduled for</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Appt time</TableHead>
                <TableHead>Offset</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableSkeletonRows rows={5} cols={7} />}
              {!loading && reminders.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{fmtDateTime(r.scheduled_for)}</TableCell>
                  <TableCell>
                    {r.patient_name}
                    <div className="text-muted-foreground text-xs">
                      {r.channel === 'sms' ? r.patient_phone : r.patient_email}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      {r.channel === 'sms' ? <MessageSquare className="size-3.5" /> : <Mail className="size-3.5" />}
                      {r.channel === 'sms' ? 'SMS' : 'Email'}
                    </span>
                  </TableCell>
                  <TableCell>{fmtDateTime(r.appt_time)}</TableCell>
                  <TableCell>{r.offset_hours}h before</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                    {r.status === 'sent' && r.detail?.startsWith('http') && (
                      <a
                        className="text-primary text-xs ml-2 hover:underline"
                        href={r.detail}
                        target="_blank"
                        rel="noreferrer"
                      >
                        preview
                      </a>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {(r.status === 'pending' || r.status === 'failed') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busyId === r.id}
                        onClick={() => send(r.id)}
                      >
                        {busyId === r.id && <Spinner />}
                        {busyId === r.id ? 'Sending…' : 'Send now'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && reminders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No reminders yet — book an appointment to generate some.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
