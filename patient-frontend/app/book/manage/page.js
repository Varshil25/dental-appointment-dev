'use client';

import { useState } from 'react';
import { ManageLookupForm } from '@/components/manage/manage-lookup-form';
import { AppointmentManager } from '@/components/manage/appointment-manager';

export default function ManagePage() {
  const [appointment, setAppointment] = useState(null);

  if (!appointment) {
    return <ManageLookupForm onFound={setAppointment} />;
  }

  return <AppointmentManager appointment={appointment} onUpdated={setAppointment} />;
}
