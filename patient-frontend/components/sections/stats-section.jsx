'use client';

import { NumberTicker } from '@/components/ui/number-ticker';
import { BlurFade } from '@/components/ui/blur-fade';

const STATS = [
  { value: 500, suffix: '+', label: 'Happy patients' },
  { value: 12, suffix: '+', label: 'Years of care' },
  { value: 98, suffix: '%', label: 'Would recommend us' },
  { value: 15, suffix: 'm', label: 'Avg. booking time' },
];

export function StatsSection() {
  return (
    <section className="border-b border-border/60 bg-secondary/30">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {STATS.map((s, i) => (
            <BlurFade key={s.label} inView delay={i * 0.06} className="text-center">
              <div className="flex items-baseline justify-center gap-0.5 text-3xl font-bold text-primary sm:text-4xl">
                <NumberTicker value={s.value} className="text-primary" />
                <span>{s.suffix}</span>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.label}</p>
            </BlurFade>
          ))}
        </div>
      </div>
    </section>
  );
}
