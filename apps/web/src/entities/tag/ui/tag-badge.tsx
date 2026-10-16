import { Tag as TagIcon } from 'lucide-react';
import { Badge } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';

export function TagBadge({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn('gap-1 font-normal max-w-full', className)}
    >
      <TagIcon className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{name}</span>
    </Badge>
  );
}
