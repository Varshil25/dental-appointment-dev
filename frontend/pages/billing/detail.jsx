import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { api, fmtDateTime } from '@/lib/api';
import { useToast } from '@/lib/use-toast';
import { downloadBlob } from '@/lib/download-blob';
import { InvoiceStatusBadge } from '@/components/invoice-status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, FileDown, CheckCircle2 } from 'lucide-react';

const fmtMoney = (n) => `$${Number(n).toFixed(2)}`;
const PAYMENT_METHODS = ['Cash', 'Card', 'Insurance', 'Other'];

export default function InvoiceDetailPage() {
  const router = useRouter();
  const id = router.query.id;
  const notify = useToast();

  const [invoice, setInvoice] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [marking, setMarking] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = () => api.getInvoice(id).then(setInvoice).catch(() => setNotFound(true));
  useEffect(() => { if (id) load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmMarkPaid() {
    setMarking(true);
    try {
      const updated = await api.markInvoicePaid(id, paymentMethod);
      setInvoice(updated);
      setMarkPaidOpen(false);
      notify('Invoice marked as paid');
    } catch (e) {
      notify(e.message, 'err');
    } finally {
      setMarking(false);
    }
  }

  async function downloadPdf() {
    setDownloading(true);
    try {
      const blob = await api.invoicePdf(id);
      downloadBlob(blob, `invoice-${id}.pdf`);
    } catch (e) {
      notify(e.message, 'err');
    } finally {
      setDownloading(false);
    }
  }

  if (notFound) {
    return (
      <div className="text-center text-muted-foreground py-12">
        Invoice not found.{' '}
        <Link href="/billing" className="text-primary hover:underline">Back to billing</Link>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <Link href="/billing" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="size-3.5" /> Back to billing
        </Link>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Invoice #{invoice.id}</h1>
            <p className="text-muted-foreground">Issued {fmtDateTime(invoice.created_at)}</p>
          </div>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm mb-4">
            <dt className="text-muted-foreground">Patient</dt>
            <dd>{invoice.patient_name || `Patient #${invoice.patient_id}`}</dd>
            <dt className="text-muted-foreground">Dentist</dt>
            <dd>{invoice.dentist_name || `Dentist #${invoice.dentist_id}`}</dd>
            {invoice.status === 'paid' && (
              <>
                <dt className="text-muted-foreground">Paid</dt>
                <dd>{fmtDateTime(invoice.paid_at)} · {invoice.payment_method}</dd>
              </>
            )}
            {invoice.notes && (
              <>
                <dt className="text-muted-foreground">Notes</dt>
                <dd>{invoice.notes}</dd>
              </>
            )}
          </dl>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.line_items.map((li, i) => (
                <TableRow key={i}>
                  <TableCell>{li.description}</TableCell>
                  <TableCell className="text-right">{fmtMoney(li.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-3 space-y-1 text-sm max-w-56 ml-auto">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{fmtMoney(invoice.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{fmtMoney(invoice.tax)}</span></div>
            <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total</span><span>{fmtMoney(invoice.total)}</span></div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 flex-wrap">
        <Button variant="outline" disabled={downloading} onClick={downloadPdf}>
          {downloading ? <Spinner /> : <FileDown className="size-4" />}
          {downloading ? 'Generating…' : 'Download PDF'}
        </Button>
        {invoice.status === 'unpaid' && (
          <Button onClick={() => setMarkPaidOpen(true)}>
            <CheckCircle2 className="size-4" /> Mark as Paid
          </Button>
        )}
      </div>

      <Dialog open={markPaidOpen} onOpenChange={setMarkPaidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              This only records that payment was taken in person or arranged directly with the patient — it does not charge a card or process any online payment.
            </DialogDescription>
          </DialogHeader>

          <Select value={paymentMethod} onValueChange={setPaymentMethod}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkPaidOpen(false)}>Cancel</Button>
            <Button disabled={marking} onClick={confirmMarkPaid}>
              {marking && <Spinner />}
              {marking ? 'Saving…' : `Confirm ${fmtMoney(invoice.total)} paid`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
