import { Card, CardContent } from '@/components/ui/card';

export function StatTile({ label, value, sub }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-sm text-muted-foreground mt-1">{label}</div>
        {sub && <div className="text-xs text-muted-foreground/70 mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}
