import { useRouter } from 'next/router';
import { useAuth } from '@/lib/auth';
import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

const BARE_PATHS = ['/login', '/forgot-password', '/reset-password'];

// Splits the app shell into two layouts: the login/forgot/reset pages
// render full-bleed with no sidebar (there's no user to show a dashboard
// chrome for yet), everything else gets the staff sidebar + header. Also
// where the loading gate lives — a page can't render `children` before
// AuthProvider knows whether there's a valid session, or a doctor would
// briefly see an admin page's content flash before the redirect in
// lib/auth.js's route-protection effect kicks in.
export function AppShell({ children }) {
  const { pathname } = useRouter();
  const { user, loading } = useAuth();
  const bare = BARE_PATHS.includes(pathname);

  if (bare) return children;

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex items-center gap-2 border-b px-4 py-3">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <span className="font-semibold">🦷 Bright Smile Dental</span>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
