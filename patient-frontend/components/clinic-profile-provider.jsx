'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';

const ClinicProfileContext = createContext({ profile: null, loading: true });

// Fetched once at the root layout and shared everywhere (header, footer,
// Clinic Info section, footer) so editing it in the staff dashboard's
// Clinic Settings page is reflected here without any hardcoded copy.
export function ClinicProfileProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    api
      .getClinicProfile()
      .then((p) => { if (!ignore) setProfile(p); })
      .catch(() => {})
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);

  return (
    <ClinicProfileContext.Provider value={{ profile, loading }}>
      {children}
    </ClinicProfileContext.Provider>
  );
}

export function useClinicProfile() {
  return useContext(ClinicProfileContext);
}
