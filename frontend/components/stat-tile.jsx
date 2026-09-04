import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const SIZES = {
  lg: { content: 'py-6', value: 'text-4xl font-bold tracking-tight', label: 'text-sm mt-1.5', sub: 'text-xs mt-0.5', iconBox: 'p-2.5', icon: 'size-5' },
  default: { content: 'py-4', value: 'text-2xl font-bold', label: 'text-sm mt-1', sub: 'text-xs mt-0.5', iconBox: 'p-2', icon: 'size-4' },
  sm: { content: 'py-3', value: 'text-lg font-semibold', label: 'text-xs mt-0.5', sub: 'text-[11px] mt-0.5', iconBox: 'p-1.5', icon: 'size-3.5' },
};

// `accent` is a Tailwind text-color class (e.g. "text-status-completed-fg")
// applied to the value and the icon; the icon keeps a neutral chip
// background so accents read as tasteful highlights, not colored blocks.
export function StatTile({ label, value, sub, icon: Icon, accent, size = 'default' }) {
  const s = SIZES[size];
  return (
    <Card>
      <CardContent className={s.content}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className={cn(s.value, accent || 'text-foreground')}>{value}</div>
            <div className={cn(s.label, 'text-muted-foreground')}>{label}</div>
            {sub && <div className={cn(s.sub, 'text-muted-foreground/70')}>{sub}</div>}
          </div>
          {Icon && (
            <div className={cn('shrink-0 rounded-lg bg-muted', s.iconBox)}>
              <Icon className={cn(s.icon, accent || 'text-muted-foreground')} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
