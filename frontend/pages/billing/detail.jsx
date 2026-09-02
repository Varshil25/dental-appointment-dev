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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, FileDown, CheckCircle2, Plus, Trash2 } from 'lucide-react';

// A stored total/subtotal can be missing or corrupt on legacy/bad rows —
// never let that render as literal "$NaN".
const fmtMoney = (n) => (Number.isFinite(Number(n)) ? `$${Number(n).toFixed(2)}` : '—');
const PAYMENT_METHODS = ['Cash', 'Card', 'Insurance', 'Other'];
const emptyLine = () => ({ description: '', amount: '' });

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
  const [editingItems, setEditingItems] = useState(false);
  const [lines, setLines] = useState([emptyLine()]);
  const [savingItems, setSavingItems] = useState(false);

  const load = () => api.getInvoice(id).then(setInvoice).catch(() => setNotFound(true));
  useEffect(() => { if (id) load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateLine(i, field, value) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  }
  function addLine() { setLines((prev) => [...prev, emptyLine()]); }
  function removeLine(i) { setLines((prev) => prev.filter((_, idx) => idx !== i)); }

  async function saveLineItems() {
    const cleaned = lines
      .map((l) => ({ description: l.description.trim(), amount: Number(l.amount) }))
      .filter((l) => l.description && Number.isFinite(l.amount) && l.amount >= 0);
    if (cleaned.length === 0) return notify('Add at least one line item with a description and amount', 'err');

    setSavingItems(true);
    try {
      const updated = await api.updateInvoiceLineItems(id, { line_items: cleaned });
      setInvoice(updated);
      setEditingItems(false);
      notify('Line items saved');
    } catch (e) {
      notify(e.message, 'err');
    } finally {
      setSavingItems(false);
    }
  }

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

  const hasItems = Array.isArray(invoice.line_items) && invoice.line_items.length > 0;

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

          {hasItems && (
            <>
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
            </>
          )}

          {!hasItems && !editingItems && (
            <div className="text-center py-8 space-y-3">
              <p className="text-muted-foreground">No line items added yet.</p>
              {invoice.status === 'unpaid' && (
                <Button size="sm" onClick={() => { setLines([emptyLine()]); setEditingItems(true); }}>
                  <Plus className="size-4" /> Add line items
                </Button>
              )}
            </div>
          )}

          {editingItems && (
            <div className="space-y-3">
              {lines.map((line, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder="Description (e.g. Consultation)"
                    value={line.description}
                    onChange={(e) => updateLine(i, 'description', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={line.amount}
                    onChange={(e) => updateLine(i, 'amount', e.target.value)}
                    className="w-28"
                  />
                  <Button type="button" variant="ghost" size="icon-sm" disabled={lines.length === 1} onClick={() => removeLine(i)}>
                    <Trash2 className="size-4" />
                    <span className="sr-only">Remove line</span>
                  </Button>
                </div>
              ))}
              <div className="flex items-center justify-between">
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="size-4" /> Add line
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingItems(false)}>Cancel</Button>
                  <Button size="sm" disabled={savingItems} onClick={saveLineItems}>
                    {savingItems && <Spinner />}
                    {savingItems ? 'Saving…' : 'Save line items'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2 flex-wrap">
        <Button variant="outline" disabled={downloading} onClick={downloadPdf}>
          {downloading ? <Spinner /> : <FileDown className="size-4" />}
          {downloading ? 'Generating…' : 'Download PDF'}
        </Button>
        {invoice.status === 'unpaid' && hasItems && (
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
