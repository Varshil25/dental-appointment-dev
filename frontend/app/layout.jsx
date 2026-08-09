import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AppSidebar } from '@/components/app-sidebar';
import { Toaster } from '@/components/ui/sonner';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';

export const metadata = {
  title: 'Bright Smile Dental — Booking & Reminders',
  description: 'Dental Clinic Appointment Booking & Reminder System',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <TooltipProvider>
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
          </TooltipProvider>
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
