'use client';

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

// Click-to-select 1-5 star input. Hover previews the rating a click would
// set; the actually-selected value is what stays filled once the pointer
// leaves.
export function StarRating({ value, onChange, disabled }) {
  return (
    <div role="radiogroup" aria-label="Rating" className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          disabled={disabled}
          onClick={() => onChange(n)}
          className="rounded p-0.5 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-primary"
        >
          <Star
            className={cn(
              'size-9 transition-colors',
              n <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/25 hover:text-amber-300'
            )}
          />
        </button>
      ))}
    </div>
  );
}
