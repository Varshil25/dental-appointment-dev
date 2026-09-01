import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { api, fmtDateTime } from '@/lib/api';
import { useToast } from '@/lib/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';

const fmtMoney = (n) => `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
const emptyLine = () => ({ description: '', amount: '' });

export default function NewInvoicePage() {
  const router = useRouter();
  const appointmentId = router.query.appointmentId;
  const notify = useToast();

  const [appt, setAppt] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [lines, setLines] = useState([emptyLine()]);
  const [tax, setTax] = useState('0');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!appointmentId) return;
    api.getAppointment(appointmentId).then(setAppt).catch(() => setNotFound(true));
  }, [appointmentId]);

  useEffect(() => {
    // An appointment can only ever carry one invoice — bounce back to it
    // instead of letting a second POST hit the backend's 409.
    if (appt?.invoice_id) router.replace(`/billing/detail?id=${appt.invoice_id}`);
  }, [appt, router]);

  const subtotal = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const taxAmount = Number(tax) || 0;
  const total = subtotal + taxAmount;

  function updateLine(i, field, value) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  }
  function addLine() { setLines((prev) => [...prev, emptyLine()]); }
  function removeLine(i) { setLines((prev) => prev.filter((_, idx) => idx !== i)); }

  async function save() {
    const cleaned = lines
      .map((l) => ({ description: l.description.trim(), amount: Number(l.amount) }))
      .filter((l) => l.description && Number.isFinite(l.amount) && l.amount >= 0);
    if (cleaned.length === 0) return notify('Add at least one line item with a description and amount', 'err');

    setSaving(true);
    try {
      const invoice = await api.createInvoice({
        appointment_id: Number(appointmentId),
        line_items: cleaned,
        tax: taxAmount,
        notes: notes.trim() || undefined,
      });
      notify('Invoice created');
      router.replace(`/billing/detail?id=${invoice.id}`);
    } catch (e) {
      notify(e.message, 'err');
    } finally {
      setSaving(false);
    }
  }

  if (notFound) {
    return (
      <div className="text-center text-muted-foreground py-12">
        Appointment not found.{' '}
        <Link href="/appointments" className="text-primary hover:underline">Back to appointments</Link>
      </div>
    );
  }

  if (!appointmentId || !appt) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <Link href="/appointments" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="size-3.5" /> Back to appointments
        </Link>
        <h1 className="text-2xl font-bold">New Invoice</h1>
        <p className="text-muted-foreground">
          {appt.patient_name} · {appt.dentist_name} · {fmtDateTime(appt.start_time)}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Line items</CardTitle></CardHeader>
        <CardContent className="space-y-3">
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
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={lines.length === 1}
                onClick={() => removeLine(i)}
              >
                <Trash2 className="size-4" />
                <span className="sr-only">Remove line</span>
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="size-4" /> Add line
          </Button>

          <div className="pt-2 border-t space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{fmtMoney(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <Label htmlFor="tax" className="text-muted-foreground">Tax</Label>
              <Input
                id="tax"
                type="number"
                min="0"
                step="0.01"
                value={tax}
                onChange={(e) => setTax(e.target.value)}
                className="w-28"
              />
            </div>
            <div className="flex items-center justify-between font-bold text-base">
              <span>Total</span>
              <span>{fmtMoney(total)}</span>
            </div>
          </div>

          <div className="pt-2 space-y-1.5">
            <Label htmlFor="notes" className="text-muted-foreground">Notes (optional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button disabled={saving} onClick={save}>
          {saving && <Spinner />}
          {saving ? 'Saving…' : 'Save invoice'}
        </Button>
      </div>
    </div>
  );
}
