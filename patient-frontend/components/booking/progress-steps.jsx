'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const LABELS = ['Reason', 'Dentist', 'Date & Time', 'Your Details', 'Review'];

export function ProgressSteps({ current }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-0">
      <ol className="flex items-center">
        {LABELS.map((label, i) => {
          const step = i + 1;
          const done = step < current;
          const active = step === current;
          return (
            <li key={label} className={cn('flex items-center', i < LABELS.length - 1 && 'flex-1')}>
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors',
                    done && 'border-primary bg-primary text-primary-foreground',
                    active && 'border-primary text-primary',
                    !done && !active && 'border-border text-muted-foreground'
                  )}
                  aria-current={active ? 'step' : undefined}
                >
                  {done ? <Check className="size-4" /> : step}
                </div>
                <span
                  className={cn(
                    'hidden text-[11px] font-medium sm:block',
                    active ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {label}
                </span>
              </div>
              {i < LABELS.length - 1 && (
                <div className={cn('mx-2 h-0.5 flex-1 rounded-full transition-colors', done ? 'bg-primary' : 'bg-border')} />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
