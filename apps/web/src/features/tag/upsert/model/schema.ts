import { z } from 'zod';

export const tagSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name')
    .max(50, 'At most 50 characters'),
});

export type TagFormValues = z.infer<typeof tagSchema>;
