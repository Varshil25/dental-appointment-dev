import Link from 'next/link';
import { useRouter } from 'next/router';
import { LayoutDashboard, CalendarPlus, CalendarClock, Users, Bell, Stethoscope, Settings, MessageSquare, LogOut, UserPlus } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
import { useAuth } from '@/lib/auth';
import { initials } from '@/lib/initials';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';

// Admin sees everything. A doctor's nav is a strict subset — their own
// dentist profile (not the full directory), appointments (scoped
// server-side by the gateway to just their own, see
// services/gateway/src/auth.js's scopeAppointmentsList), and booking.
// Patients, Reminders, Inquiries, and Clinic Settings are staff-wide/
// admin-only concerns a doctor has no view into.
const ADMIN_LINKS = [
  ['/', 'Dashboard', LayoutDashboard],
  ['/book', 'Book Appointment', CalendarPlus],
  ['/appointments', 'Appointments', CalendarClock],
  ['/dentists', 'Dentists', Stethoscope],
  ['/dentist-applications', 'Doctor Applications', UserPlus],
  ['/patients', 'Patients', Users],
  ['/reminders', 'Reminders', Bell],
  ['/inquiries', 'Inquiries', MessageSquare],
  ['/clinic-settings', 'Clinic Settings', Settings],
];

export function AppSidebar() {
  const { pathname } = useRouter();
  const { user, logout } = useAuth();
  if (!user) return null;

  const links = user.role === 'admin'
    ? ADMIN_LINKS
    : [
        ['/', 'Dashboard', LayoutDashboard],
        ['/book', 'Book Appointment', CalendarPlus],
        ['/appointments', 'Appointments', CalendarClock],
        [`/dentists/detail?id=${user.dentist_id}`, 'My Profile', Stethoscope],
      ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1 text-lg font-bold group-data-[collapsible=icon]:justify-center">
          <span>🦷</span>
          <span className="group-data-[collapsible=icon]:hidden">Bright Smile</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {links.map(([href, label, Icon]) => {
                const path = href.split('?')[0];
                const active = path === '/' ? pathname === '/' : pathname.startsWith(path);
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton isActive={active} tooltip={label} render={<Link href={href} />}>
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center">
          <Avatar className="size-7 shrink-0">
            <AvatarFallback className="text-[11px]">{initials(user.name || user.email)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <div className="text-xs font-medium truncate">{user.name || user.email}</div>
            <div className="text-[11px] text-sidebar-foreground/60 capitalize">{user.role}</div>
          </div>
          <Tooltip>
            <TooltipTrigger
              render={<Button variant="ghost" size="icon-sm" onClick={logout} />}
            >
              <LogOut className="size-4" />
              <span className="sr-only">Log out</span>
            </TooltipTrigger>
            <TooltipContent>Log out</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center justify-between px-2 py-1 group-data-[collapsible=icon]:justify-center">
          <span className="text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">Prototype</span>
          <ModeToggle />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
