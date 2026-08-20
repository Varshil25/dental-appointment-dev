'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, Stethoscope } from 'lucide-react';
import { useClinicProfile } from '@/components/clinic-profile-provider';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from '@/components/ui/sheet';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/#dentists', label: 'Our Dentists' },
  { href: '/book', label: 'Book Appointment' },
  { href: '/contact', label: 'Contact' },
];

function ClinicBrand() {
  const { profile, loading } = useClinicProfile();
  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="h-5 w-32" />
      </div>
    );
  }
  return (
    <Link href="/" className="flex items-center gap-2.5 font-semibold text-lg tracking-tight">
      {profile?.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.logo_url} alt="" className="size-8 rounded-full object-cover" />
      ) : (
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Stethoscope className="size-4" />
        </span>
      )}
      <span>{profile?.clinic_name || 'Dental Clinic'}</span>
    </Link>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <ClinicBrand />

        <nav className="hidden items-center gap-7 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:block">
          <Button asChild size="sm" className="rounded-full px-5">
            <Link href="/book">Book Now</Link>
          </Button>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-4">
              {NAV.map((item) => (
                <SheetClose asChild key={item.href}>
                  <Link
                    href={item.href}
                    className="rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent"
                  >
                    {item.label}
                  </Link>
                </SheetClose>
              ))}
              <SheetClose asChild>
                <Button asChild className="mt-3 rounded-full">
                  <Link href="/book">Book Now</Link>
                </Button>
              </SheetClose>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
