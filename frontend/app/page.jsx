'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, fmtDateTime } from '@/lib/api';
import { useToast } from '@/lib/use-toast';
import { downloadBlob } from '@/lib/download-blob';
import { StatTile } from '@/components/stat-tile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { TableSkeletonRows } from '@/components/table-skeleton';
import { FileDown } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';

const dailyChartConfig = {
  count: {
    label: 'Appointments',
    theme: { light: '#2a78d6', dark: '#3987e5' },
  },
};

function fmtShortDate(dateStr) {
  const [, m, d] = dateStr.split('-');
  return `${Number(m)}/${Number(d)}`;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-96 max-w-full mt-2" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="py-4 space-y-2">
              <Skeleton className="h-7 w-14" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><Skeleton className="h-5 w-56" /></CardHeader>
        <CardContent><Skeleton className="h-[200px] w-full" /></CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
            <CardContent>
              <Table><TableBody><TableSkeletonRows rows={4} cols={3} /></TableBody></Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const notify = useToast();
  const [summary, setSummary] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [err, setErr] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const now = new Date().toISOString();
    Promise.all([api.summary(), api.listAppointments({ status: 'booked', from: now })])
      .then(([s, appts]) => {
        setSummary(s);
        setUpcoming(appts.slice(0, 6));
      })
      .catch((e) => setErr(e.message));
  }, []);

  async function downloadPdf() {
    setDownloading(true);
    try {
      const blob = await api.summaryPdf();
      downloadBlob(blob, `clinic-report-${new Date().toISOString().slice(0, 10)}.pdf`);
      notify('Report downloaded');
    } catch (e) {
      notify(e.message, 'err');
    } finally {
      setDownloading(false);
    }
  }

  if (err) return <div className="text-center text-destructive py-8">Could not reach the API: {err}</div>;
  if (!summary) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">At-a-glance metrics on appointments, no-shows, and reminders.</p>
        </div>
        <Button variant="outline" disabled={downloading} onClick={downloadPdf}>
          {downloading ? <Spinner /> : <FileDown className="size-4" />}
          {downloading ? 'Generating…' : 'Download PDF'}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total patients" value={summary.patients} sub="on file" />
        <StatTile label="Total appointments" value={summary.total} sub="all time" />
        <StatTile label="Total completed" value={summary.counts.completed || 0} sub="kept appointments" />
        <StatTile label="Total cancelled" value={summary.counts.cancelled || 0} sub="cancelled by patient" />
        <StatTile label="Total no-shows" value={summary.counts.no_show || 0} sub="missed appointments" />
        <StatTile label="Monthly appointments" value={summary.thisMonth} sub="this calendar month" />
        <StatTile label="Daily appointments" value={summary.today} sub="scheduled today" />
        <StatTile label="Upcoming" value={summary.upcoming} sub="booked & in the future" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="No-show rate" value={`${summary.noShowRate}%`} sub="of finished appts" />
        <StatTile label="Cancellation rate" value={`${summary.cancellationRate}%`} sub="of finished appts" />
        <StatTile label="Reminders sent" value={summary.remindersSent} sub="emails delivered" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appointments — last 14 days</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.dailySeries?.length ? (
            <ChartContainer config={dailyChartConfig} className="aspect-auto h-[220px] w-full">
              <BarChart data={summary.dailySeries} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tickFormatter={fmtShortDate}
                  interval="preserveStartEnd"
                />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} width={28} />
                <ChartTooltip
                  cursor={{ fill: 'var(--muted)' }}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) =>
                        new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })
                      }
                    />
                  }
                />
                <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ChartContainer>
          ) : (
            <p className="text-center text-muted-foreground py-8">No appointment activity in the last 14 days.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Appointments by status</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {Object.entries(summary.counts).map(([status, n]) => (
                  <TableRow key={status}>
                    <TableCell className="capitalize">{status.replace('_', '-')}</TableCell>
                    <TableCell className="w-3/5">
                      <div className="h-2.5 rounded-full bg-muted">
                        <div
                          className="h-2.5 rounded-full bg-primary"
                          style={{ width: `${summary.total ? (n / summary.total) * 100 : 0}%` }}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-bold">{n}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-sm text-muted-foreground mt-3">
              {summary.total} appointments · {summary.patients} patients on file
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dentist load</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dentist</TableHead>
                  <TableHead>Kept</TableHead>
                  <TableHead>No-shows</TableHead>
                  <TableHead>Cancelled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.perDentist.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.name}</TableCell>
                    <TableCell>{d.kept || 0}</TableCell>
                    <TableCell>{d.no_shows || 0}</TableCell>
                    <TableCell>{d.cancelled || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Next appointments</CardTitle>
          {/* Base UI's Button explicitly disallows composing with links via
              `render` (links have their own semantics) — style the <Link>
              directly with the same generated classes instead. */}
          <Link href="/appointments" className={buttonVariants({ variant: 'link' })}>
            View all →
          </Link>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No upcoming appointments.{' '}
              <Link href="/book" className="text-primary font-semibold hover:underline">
                Book one →
              </Link>
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Dentist</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcoming.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{fmtDateTime(a.start_time)}</TableCell>
                    <TableCell>{a.patient_name}</TableCell>
                    <TableCell>{a.dentist_name}</TableCell>
                    <TableCell className="text-muted-foreground">{a.reason || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
