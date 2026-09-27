'use client';

import {
  CURRENCIES,
  CURRENCY_DETAILS,
  DEFAULT_CURRENCY,
  type Currency,
} from '@expense-tracker/types';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { useSettingsStore } from '@/entities/settings';
import { isCurrency } from '@/shared/lib/currency';
import { getErrorMessage } from '@/shared/lib/error';
import { formatCurrency } from '@/shared/lib/format';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui';
import { RemoveCurrencyDialog } from './remove-currency-dialog';

interface CurrencyListProps {
  /** The user's enabled currencies. */
  value: Currency[];
}

/** The enabled currencies, each removable but RSD, and a picker to add more. */
export function CurrencyList({ value }: CurrencyListProps) {
  const addCurrency = useSettingsStore((state) => state.addCurrency);
  const [removing, setRemoving] = useState<Currency | null>(null);
  const [toAdd, setToAdd] = useState<Currency | ''>('');
  const [isAdding, setIsAdding] = useState(false);
  const available = CURRENCIES.filter((code) => !value.includes(code));

  async function add() {
    if (!toAdd) return;
    setIsAdding(true);
    try {
      await addCurrency(toAdd);
      setToAdd('');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-md border" aria-label="Your currencies">
        {value.map((code) => (
          <li
            key={code}
            className="flex min-h-12 items-center justify-between gap-3 px-3 py-1.5"
          >
            <div className="min-w-0">
              <span className="font-medium">{formatCurrency(code)}</span>
              <span className="ml-2 text-sm text-muted-foreground">
                {CURRENCY_DETAILS[code].name}
              </span>
            </div>
            {code === DEFAULT_CURRENCY ? (
              <span className="text-xs text-muted-foreground">Default</span>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${code}`}
                onClick={() => setRemoving(code)}
              >
                <Trash2 />
              </Button>
            )}
          </li>
        ))}
      </ul>

      {available.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Select
            value={toAdd}
            onValueChange={(next) => {
              if (isCurrency(next)) setToAdd(next);
            }}
          >
            <SelectTrigger className="w-64" aria-label="Currency to add">
              <SelectValue placeholder="Choose a currency" />
            </SelectTrigger>
            <SelectContent>
              {available.map((code) => (
                <SelectItem key={code} value={code}>
                  {formatCurrency(code)} · {CURRENCY_DETAILS[code].name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => void add()}
            disabled={!toAdd || isAdding}
          >
            <Plus />
            {isAdding ? 'Adding…' : 'Add'}
          </Button>
        </div>
      )}

      <RemoveCurrencyDialog
        currency={removing}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
      />
    </div>
  );
}
