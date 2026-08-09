import { Skeleton } from '@/components/ui/skeleton';
import { TableCell, TableRow } from '@/components/ui/table';

// Generic "N rows x M columns" skeleton body, used while a table's data is
// still loading — reused across the dashboard, reminders, patients, and
// appointments pages instead of an empty-state flash or plain text.
export function TableSkeletonRows({ rows = 5, cols = 4 }) {
  return Array.from({ length: rows }).map((_, r) => (
    <TableRow key={r}>
      {Array.from({ length: cols }).map((__, c) => (
        <TableCell key={c}>
          <Skeleton className="h-4 w-full max-w-40" />
        </TableCell>
      ))}
    </TableRow>
  ));
}
