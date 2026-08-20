import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ClinicProfileProvider } from "@/components/clinic-profile-provider";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ChatWidget } from "@/components/chat-widget";
import { Toaster } from "@/components/ui/sonner";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: {
    default: "Bright Smile Dental — Book Your Visit Online",
    template: "%s — Bright Smile Dental",
  },
  description:
    "Book a dental appointment online in minutes. Modern, gentle care for the whole family.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ClinicProfileProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
          <ChatWidget />
        </ClinicProfileProvider>
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
