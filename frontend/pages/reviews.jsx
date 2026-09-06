import { useEffect, useState } from 'react';
import { api, fmtDateTime } from '@/lib/api';
import { useToast } from '@/lib/use-toast';
import { TableSkeletonRows } from '@/components/table-skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { Star, EyeOff, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_FILTERS = ['all', 'visible', 'hidden'];
const RATING_FILTERS = ['all', '5', '4', '3', '2', '1'];

function Stars({ rating }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn('size-3.5', n <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const notify = useToast();
  const [statusFilter, setStatusFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [dentistFilter, setDentistFilter] = useState('all');
  const [dentists, setDentists] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState(null); // review a confirm dialog is open for
  const [toggling, setToggling] = useState(false);

  useEffect(() => { api.listDentists().then(setDentists).catch(() => {}); }, []);

  const load = () =>
    api
      .listReviews({
        status: statusFilter === 'all' ? undefined : statusFilter,
        rating: ratingFilter === 'all' ? undefined : ratingFilter,
        dentistId: dentistFilter === 'all' ? undefined : dentistFilter,
      })
      .then(setReviews)
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, [statusFilter, ratingFilter, dentistFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmToggle() {
    const nextStatus = target.status === 'visible' ? 'hidden' : 'visible';
    setToggling(true);
    try {
      const updated = await api.setReviewStatus(target.id, nextStatus);
      setReviews((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      notify(nextStatus === 'hidden' ? 'Review hidden' : 'Review restored');
      setTarget(null);
    } catch (e) {
      notify(e.message, 'err');
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Reviews</h1>
        <p className="text-muted-foreground">
          Ratings and comments patients leave after a completed appointment. Hiding a review keeps the
          record but removes it from the dentist&apos;s public page — nothing here is ever deleted outright.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f}
              size="sm"
              variant={statusFilter === f ? 'default' : 'outline'}
              className={cn('rounded-full capitalize', statusFilter === f && 'pointer-events-none')}
              onClick={() => setStatusFilter(f)}
            >
              {f}
            </Button>
          ))}
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <Select value={ratingFilter} onValueChange={setRatingFilter}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RATING_FILTERS.map((r) => (
                <SelectItem key={r} value={r}>{r === 'all' ? 'Any rating' : `${r} star${r === '1' ? '' : 's'}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dentistFilter} onValueChange={setDentistFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any dentist</SelectItem>
              {dentists.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Dentist</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableSkeletonRows rows={6} cols={6} />}
              {!loading && reviews.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No reviews match this view.
                  </TableCell>
                </TableRow>
              )}
              {!loading && reviews.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{fmtDateTime(r.created_at)}</TableCell>
                  <TableCell>{r.dentist_name || `Dentist #${r.dentist_id}`}</TableCell>
                  <TableCell><Stars rating={r.rating} /></TableCell>
                  <TableCell className="max-w-sm">
                    <p className="line-clamp-2 text-sm text-muted-foreground">{r.comment || '—'}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.status === 'visible' ? 'completed' : 'secondary'}>
                      {r.status === 'visible' ? 'Visible' : 'Hidden'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setTarget(r)}>
                      {r.status === 'visible' ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      {r.status === 'visible' ? 'Hide' : 'Unhide'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!target} onOpenChange={(open) => !open && !toggling && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{target?.status === 'visible' ? 'Hide this review?' : 'Restore this review?'}</DialogTitle>
            <DialogDescription>
              {target?.status === 'visible'
                ? "It stays on record here, but disappears from this dentist's public rating and review list."
                : "It becomes visible again on this dentist's public rating and review list."}
            </DialogDescription>
          </DialogHeader>
          {target && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
              <Stars rating={target.rating} />
              <p className="text-sm">{target.comment || <span className="text-muted-foreground">No comment left.</span>}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={toggling} onClick={() => setTarget(null)}>Cancel</Button>
            <Button disabled={toggling} onClick={confirmToggle}>
              {toggling && <Spinner />}
              {target?.status === 'visible' ? 'Hide review' : 'Restore review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
