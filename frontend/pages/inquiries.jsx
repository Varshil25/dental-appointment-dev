import { useEffect, useState } from 'react';
import { api, fmtDateTime } from '@/lib/api';
import { useToast } from '@/lib/use-toast';
import { TableSkeletonRows } from '@/components/table-skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Reply } from 'lucide-react';

const STATUS_BADGE = {
  new: { variant: 'default', label: 'New' },
  read: { variant: 'secondary', label: 'Read' },
  replied: { variant: 'completed', label: 'Replied' },
};

export default function InquiriesPage() {
  const notify = useToast();
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);

  const [target, setTarget] = useState(null); // the row a dialog was opened for
  const [detail, setDetail] = useState(null); // full inquiry + replies, fetched on open
  const [detailLoading, setDetailLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const load = () => api.listInquiries().then(setInquiries).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  async function markRead(id) {
    try {
      await api.setInquiryStatus(id, 'read');
      setInquiries((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'read' } : i)));
    } catch (e) {
      notify(e.message, 'err');
    }
  }

  function openInquiry(inquiry) {
    setTarget(inquiry);
    setDetail(null);
    setReplyText('');
    setDetailLoading(true);
    api.getInquiry(inquiry.id)
      .then(setDetail)
      .catch((e) => notify(e.message, 'err'))
      .finally(() => setDetailLoading(false));
  }

  function closeDialog(open) {
    if (sending) return;
    if (!open) {
      setTarget(null);
      setDetail(null);
      setReplyText('');
    }
  }

  async function sendReply() {
    const message = replyText.trim();
    if (!message) return;
    setSending(true);
    try {
      const updated = await api.replyToInquiry(target.id, message);
      setDetail(updated);
      setInquiries((prev) => prev.map((i) => (i.id === target.id ? { ...i, status: 'replied' } : i)));
      setReplyText('');
      notify(`Reply sent to ${target.email}.`);
    } catch (e) {
      notify(e.message, 'err');
    } finally {
      setSending(false);
    }
  }

  const newCount = inquiries.filter((i) => i.status === 'new').length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Inquiries</h1>
        <p className="text-muted-foreground">
          Messages submitted through the patient website&apos;s Contact form. Each one also triggers an email
          notification, but new/unread ones are tracked here too.
        </p>
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableSkeletonRows rows={5} cols={7} />}
              {!loading && inquiries.map((i) => (
                <TableRow key={i.id} className={i.status === 'new' ? 'bg-accent/40' : undefined}>
                  <TableCell className="whitespace-nowrap">{fmtDateTime(i.created_at)}</TableCell>
                  <TableCell>{i.name}</TableCell>
                  <TableCell>
                    <div>{i.email}</div>
                    {i.phone && <div className="text-muted-foreground text-xs">{i.phone}</div>}
                  </TableCell>
                  <TableCell>{i.subject}</TableCell>
                  <TableCell className="max-w-sm">
                    <p className="line-clamp-2 text-sm text-muted-foreground">{i.message}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[i.status]?.variant ?? 'secondary'}>
                      {STATUS_BADGE[i.status]?.label ?? i.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {i.status === 'new' && (
                        <Button variant="ghost" size="sm" onClick={() => markRead(i.id)}>
                          Mark read
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => openInquiry(i)}>
                        <Reply className="size-3.5" /> {i.status === 'replied' ? 'View' : 'Reply'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && inquiries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No inquiries yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {newCount > 0 && (
        <p className="text-sm text-muted-foreground">{newCount} unread {newCount === 1 ? 'inquiry' : 'inquiries'}.</p>
      )}

      <Dialog open={!!target} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{target?.subject}</DialogTitle>
            <DialogDescription>
              From {target?.name} &lt;{target?.email}&gt;{target?.phone ? ` · ${target.phone}` : ''}
            </DialogDescription>
          </DialogHeader>

          {detailLoading && (
            <div className="flex justify-center py-6"><Spinner /></div>
          )}

          {!detailLoading && detail && (
            <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
              {/* Original message */}
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{detail.name}</span>
                  <span>{fmtDateTime(detail.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{detail.message}</p>
              </div>

              {/* Reply thread, in order */}
              {detail.replies?.map((r) => (
                <div key={r.id} className="ml-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{r.sent_by_name || 'Clinic staff'} (reply)</span>
                    <span>{fmtDateTime(r.sent_at)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{r.message}</p>
                </div>
              ))}
            </div>
          )}

          <div>
            <Label htmlFor="reply-message">Reply</Label>
            <Textarea
              id="reply-message"
              className="mt-1.5"
              rows={4}
              placeholder={`Write a reply to ${target?.name || 'this inquirer'}…`}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              disabled={sending}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Sent by email to {target?.email}, with the original message quoted below your reply.
            </p>
          </div>

          <DialogFooter>
            <Button variant="ghost" disabled={sending} onClick={() => closeDialog(false)}>Close</Button>
            <Button disabled={sending || !replyText.trim()} onClick={sendReply}>
              {sending && <Spinner />}
              Send reply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
