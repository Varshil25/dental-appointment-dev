'use client';

import { useRouter } from 'next/navigation';
import { CalendarCheck, ShieldCheck, Sparkles } from 'lucide-react';
import { useClinicProfile } from '@/components/clinic-profile-provider';
import { DotPattern } from '@/components/ui/dot-pattern';
import { AnimatedGradientText } from '@/components/ui/animated-gradient-text';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { Button } from '@/components/ui/button';
import { BlurFade } from '@/components/ui/blur-fade';
import { cn } from '@/lib/utils';

export function HeroSection() {
  const router = useRouter();
  const { profile } = useClinicProfile();

  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <DotPattern
        glow
        className={cn(
          '[mask-image:radial-gradient(650px_circle_at_center,white,transparent)]',
          'text-primary/70'
        )}
      />
      <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 py-24 text-center sm:px-6 sm:py-32">
        <BlurFade inView delay={0.02}>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-4 py-1.5 text-sm text-muted-foreground shadow-sm backdrop-blur">
            <Sparkles className="size-3.5 text-primary" />
            Now booking new & returning patients
          </div>
        </BlurFade>

        <BlurFade inView delay={0.08}>
          <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Dental care that feels{' '}
            <AnimatedGradientText colorFrom="#0d9488" colorTo="#0891b2" className="font-bold">
              genuinely calming
            </AnimatedGradientText>
          </h1>
        </BlurFade>

        <BlurFade inView delay={0.14}>
          <p className="mt-6 max-w-xl text-balance text-lg text-muted-foreground">
            {profile?.clinic_name || 'Our clinic'} makes booking painless — real-time availability,
            instant confirmation, and a team that actually has time for you.
          </p>
        </BlurFade>

        <BlurFade inView delay={0.2}>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
            <ShimmerButton
              background="linear-gradient(135deg, oklch(0.5 0.09 195), oklch(0.55 0.12 220))"
              className="px-8 py-3.5 text-base font-semibold shadow-lg shadow-primary/20"
              onClick={() => router.push('/book')}
            >
              <CalendarCheck className="mr-2 size-4.5" />
              Book an Appointment
            </ShimmerButton>
            <Button
              variant="outline"
              size="lg"
              className="rounded-full px-7"
              onClick={() => document.getElementById('dentists')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Meet Our Dentists
            </Button>
          </div>
        </BlurFade>

        <BlurFade inView delay={0.26}>
          <div className="mt-8 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" />
            No account needed — book as a guest in under two minutes
          </div>
        </BlurFade>
      </div>
    </section>
  );
}
