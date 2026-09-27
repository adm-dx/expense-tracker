'use client';

import { CURRENCIES, type Currency } from '@expense-tracker/types';
import { toast } from 'sonner';
import { useSettingsStore } from '@/entities/settings';
import { getErrorMessage } from '@/shared/lib/error';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui';

function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

interface DefaultCurrencySelectProps {
  value: Currency;
  id?: string;
}

/** The same setting as the switcher in the header. */
export function DefaultCurrencySelect({ value, id }: DefaultCurrencySelectProps) {
  const update = useSettingsStore((state) => state.update);

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
      <SelectTrigger id={id} className="w-32" aria-label="Default currency">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CURRENCIES.map((code) => (
          <SelectItem key={code} value={code}>
            {code}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
