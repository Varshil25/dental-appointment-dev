'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { BookingWizard } from '@/components/booking/wizard';

function BookPageInner() {
  const searchParams = useSearchParams();
  const dentist = searchParams.get('dentist');
  return <BookingWizard initialDentistId={dentist || ''} />;
}

export default function BookPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl px-4 py-24 text-center text-muted-foreground">Loading…</div>}>
      <BookPageInner />
    </Suspense>
  );
}
