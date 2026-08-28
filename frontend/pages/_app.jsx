import Head from 'next/head';
import '@/app/globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AppShell } from '@/components/app-shell';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/lib/auth';

// Pages Router replacement for the old app/layout.jsx — wraps every page
// with the same providers. Migrated off the App Router entirely: its
// usePathname() doesn't strip `basePath` (this app is served under
// /v1/admin — see next.config.mjs), and its static-export client-side
// navigation fetches RSC payloads per route, which silently mounted the
// WRONG route's page after a correct initial server render once basePath
// was involved (https://github.com/vercel/next.js/issues/59986 is the same
// class of bug) — no reliable fix found for that short of avoiding the App
// Router. The Pages Router's router.pathname explicitly excludes basePath
// by design, and its client-side navigation doesn't do RSC payload
// fetching at all, sidestepping both problems.
export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>Bright Smile Dental — Booking & Reminders</title>
        <meta name="description" content="Dental Clinic Appointment Booking & Reminder System" />
      </Head>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <AppShell>
              <Component {...pageProps} />
            </AppShell>
          </AuthProvider>
        </TooltipProvider>
        <Toaster position="top-right" />
      </ThemeProvider>
    </>
  );
}
