import { CATEGORY_ICONS } from '@expense-tracker/types';
import { z } from 'zod';

export const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name')
    .max(50, 'At most 50 characters'),
  icon: z.enum(CATEGORY_ICONS, { message: 'Choose an icon' }),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;
