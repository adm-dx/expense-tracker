import { cn } from '@/shared/lib/utils';
import { CATEGORY_ICON_COMPONENTS, resolveCategoryIcon } from '../lib/icons';

interface CategoryIconProps {
  icon: string;
  className?: string;
}

/** The category's pictogram. Decorative: always shown next to the name. */
export function CategoryIcon({ icon, className }: CategoryIconProps) {
  // A lookup in a module-level map: the components themselves are static.
  const Icon = CATEGORY_ICON_COMPONENTS[resolveCategoryIcon(icon)];
  return (
    <Icon
      aria-hidden="true"
      data-icon={icon}
      className={cn('size-4 shrink-0', className)}
    />
  );
}
