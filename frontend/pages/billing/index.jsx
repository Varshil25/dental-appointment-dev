import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, fmtDateTime } from '@/lib/api';
import { InvoiceStatusBadge } from '@/components/invoice-status-badge';
import { TableSkeletonRows } from '@/components/table-skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const FILTERS = ['all', 'unpaid', 'paid', 'cancelled'];

const fmtMoney = (n) => (Number.isFinite(Number(n)) ? `$${Number(n).toFixed(2)}` : null);

// Legacy/corrupt rows (no line items yet, or a bad stored total) should
// never render "$NaN" — fall back to a clear draft/placeholder label instead.
function InvoiceTotalCell({ invoice }) {
  const money = fmtMoney(invoice.total);
  if (money) return money;
  if (!invoice.line_items || invoice.line_items.length === 0) return 'Draft — no items yet';
  return '—';
}

export default function BillingPage() {
  const [filter, setFilter] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () =>
    api
      .listInvoices({ status: filter === 'all' ? undefined : filter, from: from || undefined, to: to || undefined })
      .then(setInvoices)
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, [filter, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="text-muted-foreground">
          Invoices are created from a completed appointment and record payment taken at the desk — nothing here processes an online payment.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-4">
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              className={cn('rounded-full capitalize', filter === f && 'pointer-events-none')}
              onClick={() => setFilter(f)}
            >
              {f}
            </Button>
          ))}
        </div>
        <div className="flex items-end gap-2 sm:ml-auto">
          <div>
            <Label className="text-xs text-muted-foreground mb-1">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8" />
          </div>
        </div>
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Dentist</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableSkeletonRows rows={6} cols={6} />}
              {!loading && invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No invoices match this view. Invoices are added from a completed appointment.
                  </TableCell>
                </TableRow>
              )}
              {!loading && invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.patient_name || `Patient #${inv.patient_id}`}</TableCell>
                  <TableCell>{inv.dentist_name || `Dentist #${inv.dentist_id}`}</TableCell>
                  <TableCell>{fmtDateTime(inv.created_at)}</TableCell>
                  <TableCell className="text-right font-medium"><InvoiceTotalCell invoice={inv} /></TableCell>
                  <TableCell><InvoiceStatusBadge status={inv.status} /></TableCell>
                  <TableCell className="text-right">
                    <Link href={`/billing/detail?id=${inv.id}`} className="text-primary text-sm hover:underline">
                      View →
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
