'use client';

import { useEffect, useState } from 'react';
import { Users, Stethoscope } from 'lucide-react';
import { api } from '@/lib/api';
import { initials } from '@/lib/initials';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

export function StepDentist({ value, onChange, onDentistsLoaded }) {
  const [dentists, setDentists] = useState(null);

  useEffect(() => {
    api
      .listDentists()
      .then((all) => {
        const active = all.filter((d) => d.status !== 'inactive');
        setDentists(active);
        onDentistsLoaded?.(active);
      })
      .catch(() => setDentists([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold">Choose a dentist</h2>
      <p className="mt-1 text-sm text-muted-foreground">Pick someone specific, or let us find the earliest opening.</p>

      <div role="radiogroup" aria-label="Dentist" className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          role="radio"
          aria-checked={value === 'any'}
          onClick={() => onChange('any')}
          className={cn(
            'flex items-center gap-3 rounded-xl border p-4 text-left transition-all',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            value === 'any'
              ? 'border-primary bg-accent shadow-sm ring-1 ring-primary'
              : 'border-border hover:border-primary/50 hover:bg-secondary/50'
          )}
        >
          <span
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-full',
              value === 'any' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
            )}
          >
            <Users className="size-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold">No preference</span>
            <span className="block text-xs text-muted-foreground">Any available dentist — fastest booking</span>
          </span>
        </button>

        {dentists === null &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border p-4">
              <Skeleton className="size-11 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}

        {dentists?.map((d) => {
          const selected = value === String(d.id);
          return (
            <button
              key={d.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(String(d.id))}
              className={cn(
                'flex items-center gap-3 rounded-xl border p-4 text-left transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                selected
                  ? 'border-primary bg-accent shadow-sm ring-1 ring-primary'
                  : 'border-border hover:border-primary/50 hover:bg-secondary/50'
              )}
            >
              <Avatar className="size-11 border border-border">
                <AvatarFallback className="bg-secondary text-sm font-semibold">{initials(d.name)}</AvatarFallback>
              </Avatar>
              <span>
                <span className="block text-sm font-semibold">{d.name}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Stethoscope className="size-3" /> {d.specialty || 'General Dentistry'}
                </span>
              </span>
            </button>
          );
        })}

        {dentists?.length === 0 && (
          <p className="col-span-full text-sm text-muted-foreground">
            No dentists are currently bookable online — please call us to schedule.
          </p>
        )}
      </div>
    </div>
  );
}
