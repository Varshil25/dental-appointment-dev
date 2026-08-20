import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { AppShell } from '@/components/app-shell';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/lib/auth';

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
            <AuthProvider>
              <AppShell>{children}</AppShell>
            </AuthProvider>
          </TooltipProvider>
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
