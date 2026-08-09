'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CalendarPlus, CalendarClock, Users, Bell } from 'lucide-react';
import { ModeToggle } from '@/components/mode-toggle';
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

const LINKS = [
  ['/', 'Dashboard', LayoutDashboard],
  ['/book', 'Book Appointment', CalendarPlus],
  ['/appointments', 'Appointments', CalendarClock],
  ['/patients', 'Patients', Users],
  ['/reminders', 'Reminders', Bell],
];

export function AppSidebar() {
  const pathname = usePathname();

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
              {LINKS.map(([href, label, Icon]) => {
                const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
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
        <div className="flex items-center justify-between px-2 py-1 group-data-[collapsible=icon]:justify-center">
          <span className="text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">Prototype</span>
          <ModeToggle />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
