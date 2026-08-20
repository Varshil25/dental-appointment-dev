'use client';

import { Star } from 'lucide-react';
import { Marquee } from '@/components/ui/marquee';
import { BlurFade } from '@/components/ui/blur-fade';
import { initials } from '@/lib/initials';

const REVIEWS = [
  { name: 'Priya S.', text: 'Booked online in two minutes and got seen the next day. Genuinely painless experience — no pun intended.' },
  { name: 'Marcus T.', text: 'First dentist visit in years where I didn’t feel rushed. The reminder emails meant I never forgot an appointment.' },
  { name: 'Aiko N.', text: 'Rescheduling was so easy I did it from my phone during lunch. No hold music required.' },
  { name: 'Daniel R.', text: 'Took my kids here — they actually asked when we could go back. That says everything.' },
  { name: 'Fatima Z.', text: 'Clean, modern, and the staff explained every step before doing anything. Highly recommend.' },
  { name: 'Owen K.', text: 'The online slot picker showed exactly what was open — booked a same-week cleaning with no back-and-forth calls.' },
];

function ReviewCard({ name, text }) {
  return (
    <div className="mx-2 w-80 shrink-0 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
          {initials(name)}
        </div>
        <div>
          <p className="text-sm font-semibold">{name}</p>
          <div className="flex gap-0.5 text-primary">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="size-3 fill-current" />
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

export function TestimonialsSection() {
  const first = REVIEWS.slice(0, 3);
  const second = REVIEWS.slice(3);

  return (
    <section className="overflow-hidden py-24">
      <BlurFade inView>
        <div className="mx-auto max-w-xl px-4 text-center sm:px-6">
          <span className="text-sm font-semibold uppercase tracking-wide text-primary">Patient Stories</span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">What our patients say</h2>
        </div>
      </BlurFade>

      <div className="relative mt-12">
        <Marquee pauseOnHover className="[--duration:36s]">
          {first.map((r) => <ReviewCard key={r.name} {...r} />)}
        </Marquee>
        <Marquee reverse pauseOnHover className="mt-4 [--duration:32s]">
          {second.map((r) => <ReviewCard key={r.name} {...r} />)}
        </Marquee>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-background to-transparent" />
      </div>
    </section>
  );
}
