'use client';

import { useEffect, useState } from 'react';
import { api, fmtDateTime } from '@/lib/api';
import { useToast } from '@/lib/use-toast';
import { TableSkeletonRows } from '@/components/table-skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function InquiriesPage() {
  const notify = useToast();
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);

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
                    <Badge variant={i.status === 'new' ? 'default' : 'secondary'}>
                      {i.status === 'new' ? 'New' : 'Read'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {i.status === 'new' && (
                      <Button variant="ghost" size="sm" onClick={() => markRead(i.id)}>
                        Mark read
                      </Button>
                    )}
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
    </div>
  );
}
