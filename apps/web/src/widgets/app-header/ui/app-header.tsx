'use client';

import { LogOut, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useLogout } from '@/features/auth/logout';
import { CurrencySelect } from '@/features/currency/select';
import { WeatherWidget } from '@/features/weather/current';
import { useSessionStore } from '@/entities/session';
import { getInitials } from '@/shared/lib/format';
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui';

export function AppHeader() {
  const user = useSessionStore((state) => state.user);
  const { logout } = useLogout();

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      {/* Equal side columns keep the weather centred on the page. */}
      <div className="grid h-14 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4 sm:gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 justify-self-start whitespace-nowrap font-semibold"
        >
          <Wallet className="size-5 shrink-0" />
          <span className="max-sm:sr-only">Expense Tracker</span>
        </Link>
        {user && (
          <div className="flex justify-center">
            <WeatherWidget />
          </div>
        )}
        {user && (
          <div className="flex items-center gap-2 justify-self-end">
            <CurrencySelect />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="size-9 rounded-full p-0"
                  aria-label="Open profile menu"
                >
                  <Avatar className="size-8">
                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void logout()}>
                  <LogOut />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </header>
  );
}
