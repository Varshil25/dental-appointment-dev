'use client';

import { CalendarClock, HeartHandshake, BellRing, ShieldCheck, Smile } from 'lucide-react';
import { BentoCard, BentoGrid } from '@/components/ui/bento-grid';
import { BlurFade } from '@/components/ui/blur-fade';
import { FlickeringGrid } from '@/components/ui/flickering-grid';

const FEATURES = [
  {
    name: 'Real-time availability',
    description: 'See every open slot live — no phone tag, no waiting for a callback.',
    Icon: CalendarClock,
    href: '/book',
    cta: 'Book now',
    className: 'col-span-3 lg:col-span-2 lg:row-span-2',
    background: (
      <div className="absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,transparent,white_60%)]">
        <FlickeringGrid squareSize={3} gridGap={5} flickerChance={0.25} color="#0d9488" maxOpacity={0.35} />
      </div>
    ),
  },
  {
    name: 'Gentle, modern care',
    description: 'Comfort-first techniques and equipment for even the most nervous patients.',
    Icon: HeartHandshake,
    href: '/book',
    cta: 'Meet the team',
    className: 'col-span-3 lg:col-span-1',
    background: null,
  },
  {
    name: 'Never miss a visit',
    description: 'Automatic email & SMS reminders before every appointment.',
    Icon: BellRing,
    href: '/book',
    cta: 'Learn more',
    className: 'col-span-3 lg:col-span-1',
    background: null,
  },
  {
    name: 'Reschedule anytime',
    description: 'Manage or move your booking online in seconds — no call required.',
    Icon: ShieldCheck,
    href: '/book/manage',
    cta: 'Manage a booking',
    className: 'col-span-3 lg:col-span-2',
    background: null,
  },
  {
    name: 'Loved by families',
    description: 'A calm, judgment-free environment for kids, adults, and anyone due for a check-up.',
    Icon: Smile,
    href: '/contact',
    cta: 'Ask us anything',
    className: 'col-span-3',
    background: null,
  },
];

export function FeaturesSection() {
  return (
    <section className="border-y border-border/60 bg-secondary/30">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <BlurFade inView>
          <div className="mx-auto max-w-xl text-center">
            <span className="text-sm font-semibold uppercase tracking-wide text-primary">Why Choose Us</span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Dental care, without the dread</h2>
          </div>
        </BlurFade>

        <BlurFade inView delay={0.1} className="mt-12">
          <BentoGrid className="auto-rows-[14rem] lg:auto-rows-[11rem]">
            {FEATURES.map((f) => (
              <BentoCard key={f.name} {...f} />
            ))}
          </BentoGrid>
        </BlurFade>
      </div>
    </section>
  );
}
