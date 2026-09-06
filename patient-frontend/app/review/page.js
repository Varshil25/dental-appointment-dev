'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ReviewForm } from '@/components/review/review-form';

function ReviewPageInner() {
  const searchParams = useSearchParams();
  const appointment = searchParams.get('appointment');
  return <ReviewForm appointmentId={appointment} />;
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl px-4 py-24 text-center text-muted-foreground">Loading…</div>}>
      <ReviewPageInner />
    </Suspense>
  );
}
