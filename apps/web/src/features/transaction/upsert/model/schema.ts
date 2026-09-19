import { z } from 'zod';

const MAX_AMOUNT = 9_999_999_999.99;

export const transactionSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  categoryId: z.string().min(1, 'Choose a category'),
  amount: z
    .string()
    .trim()
    .min(1, 'Enter an amount')
    .regex(/^\d+(\.\d{1,2})?$/, 'Use a positive number with up to 2 decimals')
    .refine((value) => Number(value) > 0, 'Amount must be greater than 0')
    .refine((value) => Number(value) <= MAX_AMOUNT, 'Amount is too large'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date'),
  description: z.string().trim().max(255, 'At most 255 characters'),
});

export type TransactionFormValues = z.infer<typeof transactionSchema>;
