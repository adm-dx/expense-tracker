import { Tag as TagIcon, X } from 'lucide-react';
import { Badge } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';

export function TagBadge({
  name,
  className,
  onRemove,
  removeDisabled = false,
}: {
  name: string;
  className?: string;
  /** Shows a × button that calls it. */
  onRemove?: () => void;
  removeDisabled?: boolean;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        'gap-1 font-normal max-w-full',
        onRemove && 'pr-1',
        className
      )}
    >
      <TagIcon className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={removeDisabled}
          aria-label={`Remove tag ${name}`}
          className="-my-0.5 shrink-0 rounded-sm p-0.5 text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        >
          <X className="size-3" aria-hidden />
        </button>
      )}
    </Badge>
  );
}
