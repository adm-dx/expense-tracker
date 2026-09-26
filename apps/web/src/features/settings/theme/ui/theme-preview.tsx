import type { ColorScheme } from '@expense-tracker/types';
import { cn } from '@/shared/lib/utils';
import type { ThemeMode } from '@/shared/lib/theme';

interface ThemePreviewProps {
  colorScheme: ColorScheme;
  mode: ThemeMode;
  className?: string;
}

/**
 * A miniature of the app in a color scheme. The attributes switch the design
 * tokens for this subtree only (see globals.css), so it is painted with the
 * very colors the app would get, not a mock-up of them.
 */
export function ThemePreview({ colorScheme, mode, className }: ThemePreviewProps) {
  return (
    <div
      data-scheme={colorScheme}
      data-mode={mode}
      aria-hidden="true"
      className={cn(
        'space-y-1.5 bg-background p-2 text-foreground',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="h-1.5 w-10 rounded-full bg-foreground/80" />
        <span className="size-2.5 rounded-full bg-primary" />
      </div>
      <div className="space-y-1 rounded-md border bg-card p-1.5 text-card-foreground">
        <span className="block h-1 w-8 rounded-full bg-muted-foreground/60" />
        <span className="block text-[11px] font-semibold leading-none tabular-nums">
          12 450
        </span>
        <span className="block h-1 w-full rounded-full bg-muted" />
      </div>
      <div className="flex gap-1">
        <span className="h-3 flex-1 rounded-sm bg-primary" />
        <span className="h-3 flex-1 rounded-sm border bg-secondary" />
      </div>
    </div>
  );
}
