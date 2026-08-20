'use client';

import { Stethoscope, Sparkles, Hammer, Siren, MessageCircle, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';

export const REASONS = [
  { value: 'Check-up', Icon: Stethoscope, blurb: 'Routine exam & oral health review' },
  { value: 'Cleaning', Icon: Sparkles, blurb: 'Professional clean & polish' },
  { value: 'Filling', Icon: Hammer, blurb: 'Cavity or existing filling repair' },
  { value: 'Emergency', Icon: Siren, blurb: 'Pain, injury, or urgent issue' },
  { value: 'Consultation', Icon: MessageCircle, blurb: 'Discuss treatment options' },
  { value: 'Other', Icon: MoreHorizontal, blurb: "Something else — tell us more later" },
];

export function StepReason({ value, onChange }) {
  return (
    <div>
      <h2 className="text-xl font-semibold">What&apos;s the reason for your visit?</h2>
      <p className="mt-1 text-sm text-muted-foreground">This helps us allocate the right amount of time.</p>

      <div
        role="radiogroup"
        aria-label="Reason for visit"
        className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {REASONS.map(({ value: v, Icon, blurb }) => {
          const selected = value === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(v)}
              className={cn(
                'flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                selected
                  ? 'border-primary bg-accent shadow-sm ring-1 ring-primary'
                  : 'border-border hover:border-primary/50 hover:bg-secondary/50'
              )}
            >
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-full',
                  selected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                )}
              >
                <Icon className="size-4.5" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{v}</span>
                <span className="block text-xs text-muted-foreground">{blurb}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
