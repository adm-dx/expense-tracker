'use client';

import type { Currency } from '@expense-tracker/types';
import { toast } from 'sonner';
import { useEnabledCurrencies, useSettingsStore } from '@/entities/settings';
import { isCurrency } from '@/shared/lib/currency';
import { getErrorMessage } from '@/shared/lib/error';
import { formatCurrency } from '@/shared/lib/format';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui';

interface DefaultCurrencySelectProps {
  value: Currency;
  id?: string;
}

/** The same setting as the switcher in the header. */
export function DefaultCurrencySelect({
  value,
  id,
}: DefaultCurrencySelectProps) {
  const update = useSettingsStore((state) => state.update);
  const currencies = useEnabledCurrencies();

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (!isCurrency(next) || next === value) return;
        update({ currency: next }).catch((err: unknown) => {
          toast.error(getErrorMessage(err));
        });
      }}
    >
      <SelectTrigger id={id} className="w-40" aria-label="Default currency">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {currencies.map((code) => (
          <SelectItem key={code} value={code}>
            {formatCurrency(code)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
