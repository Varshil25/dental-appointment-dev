'use client';

import { useEffect, useState } from 'react';
import { api, fmtDateTime } from '@/lib/api';
import { useToast } from '@/lib/use-toast';
import { initials } from '@/lib/initials';
import { TableSkeletonRows } from '@/components/table-skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Mail, Phone, Check, X } from 'lucide-react';

const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const STATUS_BADGE = {
  pending: { variant: 'pending', label: 'Pending' },
  approved: { variant: 'completed', label: 'Approved' },
  rejected: { variant: 'cancelled', label: 'Rejected' },
};

// Admin-only — enforced two ways: the gateway rejects a non-admin's GET/POST
// (services/gateway/src/server.js), and lib/auth.js's route guard redirects
// a doctor away from this page before it ever renders (it's in that file's
// ADMIN_ONLY_PATHS).
export default function DentistApplicationsPage() {
  const notify = useToast();
  const [tab, setTab] = useState('pending');
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approveTarget, setApproveTarget] = useState(null); // application | null
  const [rejectTarget, setRejectTarget] = useState(null); // application | null
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = (status) =>
    api.listDentistApplications(status).then(setApplications).finally(() => setLoading(false));

  useEffect(() => { load(tab); }, [tab]);

  async function confirmApprove() {
    setBusy(true);
    try {
      const result = await api.approveDentistApplication(approveTarget.id);
      notify(
        result.email_sent
          ? `${approveTarget.name} approved — their login and temporary password were emailed to ${approveTarget.email}.`
          : `${approveTarget.name} approved, but the credentials email failed to send — check notification-service.`,
        result.email_sent ? 'ok' : 'err'
      );
      setApproveTarget(null);
      load(tab);
    } catch (e) {
      notify(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  async function confirmReject() {
    setBusy(true);
    try {
      await api.rejectDentistApplication(rejectTarget.id, rejectReason.trim() || undefined);
      notify(`${rejectTarget.name}'s application was rejected.`);
      setRejectTarget(null);
      setRejectReason('');
      load(tab);
    } catch (e) {
      notify(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Doctor Applications</h1>
        <p className="text-muted-foreground">
          Review applications from prospective dentists who applied to join the clinic. Approving one creates
          their dentist profile and staff login automatically.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            <Card>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Applicant</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Specialization</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Submitted</TableHead>
                      {t.value !== 'pending' && <TableHead>Reviewed</TableHead>}
                      <TableHead className="text-right">{t.value === 'pending' ? 'Actions' : 'Status'}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && <TableSkeletonRows rows={4} cols={t.value === 'pending' ? 6 : 7} />}
                    {!loading && applications.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar className="size-8 shrink-0">
                              <AvatarFallback className="text-xs">{initials(a.name)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium truncate">{a.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm truncate"><Mail className="size-3.5 shrink-0 text-muted-foreground" /> {a.email}</div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Phone className="size-3 shrink-0" /> {a.phone}</div>
                        </TableCell>
                        <TableCell>{a.specialization}</TableCell>
                        <TableCell className="max-w-xs">
                          <p className="line-clamp-2 text-sm text-muted-foreground">{a.notes || '—'}</p>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{fmtDateTime(a.submitted_at)}</TableCell>
                        {t.value !== 'pending' && (
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {a.reviewed_at ? fmtDateTime(a.reviewed_at) : '—'}
                            {t.value === 'rejected' && a.rejection_reason && (
                              <p className="mt-0.5 text-xs italic max-w-48 truncate" title={a.rejection_reason}>
                                &ldquo;{a.rejection_reason}&rdquo;
                              </p>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          {t.value === 'pending' ? (
                            <div className="flex justify-end gap-1.5">
                              <Button size="sm" variant="outline" onClick={() => setRejectTarget(a)}>
                                <X className="size-3.5" /> Reject
                              </Button>
                              <Button size="sm" onClick={() => setApproveTarget(a)}>
                                <Check className="size-3.5" /> Approve
                              </Button>
                            </div>
                          ) : (
                            <Badge variant={STATUS_BADGE[a.status].variant}>{STATUS_BADGE[a.status].label}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!loading && applications.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={t.value === 'pending' ? 6 : 7} className="text-center text-muted-foreground py-8">
                          No {t.label.toLowerCase()} applications.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!approveTarget} onOpenChange={(o) => !busy && !o && setApproveTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve {approveTarget?.name}?</DialogTitle>
            <DialogDescription>
              This creates a dentist profile and a doctor login for <strong>{approveTarget?.email}</strong>, then
              emails them a system-generated temporary password. They can change it from the sign-in page&apos;s
              &quot;Forgot password?&quot; link after logging in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={busy} onClick={() => setApproveTarget(null)}>Cancel</Button>
            <Button disabled={busy} onClick={confirmApprove}>
              {busy && <Spinner />}
              Approve &amp; send login
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!rejectTarget}
        onOpenChange={(o) => { if (!busy && !o) { setRejectTarget(null); setRejectReason(''); } }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject {rejectTarget?.name}&apos;s application?</DialogTitle>
            <DialogDescription>
              An optional note below is included in the rejection email sent to {rejectTarget?.email}.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Reason (optional)</Label>
            <Textarea
              className="mt-1.5"
              rows={3}
              placeholder="e.g. We're not hiring for this specialization right now."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" disabled={busy} onClick={() => { setRejectTarget(null); setRejectReason(''); }}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={busy} onClick={confirmReject}>
              {busy && <Spinner />}
              Reject application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
