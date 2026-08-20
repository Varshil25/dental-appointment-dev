'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Stethoscope, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { initials } from '@/lib/initials';
import { MagicCard } from '@/components/ui/magic-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

function DentistCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <Skeleton className="size-14 rounded-full" />
      <Skeleton className="mt-4 h-5 w-32" />
      <Skeleton className="mt-2 h-4 w-24" />
      <Skeleton className="mt-6 h-9 w-full rounded-full" />
    </div>
  );
}

export function DentistsSection() {
  const router = useRouter();
  const [dentists, setDentists] = useState(null);

  useEffect(() => {
    api
      .listDentists()
      .then((all) => setDentists(all.filter((d) => d.status !== 'inactive')))
      .catch(() => setDentists([]));
  }, []);

  return (
    <section id="dentists" className="mx-auto max-w-6xl px-4 py-24 sm:px-6 scroll-mt-20">
      <BlurFade inView>
        <div className="mx-auto max-w-xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wide text-primary">Our Team</span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Meet our dentists</h2>
          <p className="mt-3 text-muted-foreground">
            Every dentist on our team is fully booked through our live calendar — pick one and see their
            next open slot instantly.
          </p>
        </div>
      </BlurFade>

      <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {dentists === null &&
          Array.from({ length: 3 }).map((_, i) => <DentistCardSkeleton key={i} />)}

        {dentists?.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground">
            No dentists are available to book online right now — please call us.
          </p>
        )}

        {dentists?.map((d, i) => (
          <BlurFade key={d.id} inView delay={i * 0.08}>
            <MagicCard
              className="h-full rounded-2xl p-6"
              gradientColor="oklch(0.94 0.03 190)"
              gradientFrom="#0d9488"
              gradientTo="#38bdf8"
            >
              <div className="flex h-full flex-col">
                <Avatar className="size-14 border border-border">
                  <AvatarFallback className="bg-accent text-accent-foreground text-lg font-semibold">
                    {initials(d.name)}
                  </AvatarFallback>
                </Avatar>
                <h3 className="mt-4 text-lg font-semibold">{d.name}</h3>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Stethoscope className="size-3.5" />
                  {d.specialty || 'General Dentistry'}
                </p>
                <Button
                  className="mt-6 w-full rounded-full"
                  variant="outline"
                  onClick={() => router.push(`/book?dentist=${d.id}`)}
                >
                  Book with {d.name.split(' ')[0]}
                  <ArrowRight className="ml-1.5 size-3.5" />
                </Button>
              </div>
            </MagicCard>
          </BlurFade>
        ))}
      </div>
    </section>
  );
}
