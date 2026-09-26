'use client';

import {
  ChartColumn,
  LayoutDashboard,
  Settings,
  Tags,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSessionStore } from '@/entities/session';
import { getInitials } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Avatar, AvatarFallback, Separator } from '@/shared/ui';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/categories', label: 'Categories', icon: Tags },
  { href: '/reports', label: 'Reports', icon: ChartColumn },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  return href === '/'
    ? pathname === '/'
    : pathname === href || pathname.startsWith(`${href}/`);
}

const linkClassName =
  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors max-md:justify-center max-md:px-0';

function linkStateClassName(active: boolean): string {
  return active
    ? 'bg-accent font-medium text-accent-foreground'
    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground';
}

// Below `md` the sidebar collapses to an icon rail, so every label is kept for
// screen readers and shown as a tooltip.
export function AppSidebar() {
  const pathname = usePathname();
  const user = useSessionStore((state) => state.user);

  return (
    <aside className="sticky top-14 flex h-[calc(100vh-3.5rem)] w-16 shrink-0 flex-col gap-2 border-r bg-background p-2 md:w-60 md:p-3">
      {user && (
        <>
          <Link
            href="/profile"
            title={user.name}
            aria-current={isActive(pathname, '/profile') ? 'page' : undefined}
            className={cn(
              linkClassName,
              'py-2 max-md:py-1',
              linkStateClassName(isActive(pathname, '/profile'))
            )}
          >
            <Avatar className="size-8 shrink-0">
              <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 max-md:sr-only">
              <span className="block truncate font-medium text-foreground">
                {user.name}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </span>
          </Link>
          <Separator />
        </>
      )}
      <nav aria-label="Main" className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-current={active ? 'page' : undefined}
              className={cn(linkClassName, linkStateClassName(active))}
            >
              <Icon className="size-4 shrink-0" />
              <span className="max-md:sr-only">{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
