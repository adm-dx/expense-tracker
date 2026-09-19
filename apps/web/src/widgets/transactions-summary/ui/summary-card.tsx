'use client';

import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';

interface SummaryCardProps {
  title: string;
  icon: LucideIcon;
  amount: string | null;
  caption: string;
  isLoading: boolean;
  amountClassName?: string;
}

export function SummaryCard({
  title,
  icon: Icon,
  amount,
  caption,
  isLoading,
  amountClassName,
}: SummaryCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading || amount === null ? (
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        ) : (
          <p
            className={cn(
              'text-2xl font-semibold tabular-nums',
              amountClassName
            )}
          >
            {amount}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
      </CardContent>
    </Card>
  );
}
