'use client';

import {
  DEFAULT_CURRENCY,
  type Currency,
  type ExchangeRates,
} from '@expense-tracker/types';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useCurrencyStore, useExchangeRatesStore } from '@/entities/currency';
import { useEnabledCurrencies, useSettingsStore } from '@/entities/settings';
import { isCurrency } from '@/shared/lib/currency';
import { getErrorMessage } from '@/shared/lib/error';
import { formatCurrency, formatDate } from '@/shared/lib/format';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui';

const rateFormatter = new Intl.NumberFormat('en-US', {
  maximumSignificantDigits: 4,
});

/**
 * "1 EUR (€) = 117.5 RSD (дин.)" for each of the other `currencies`, priced
 * in `target`; a code without a rate today is left out.
 */
function describeRates(
  rates: ExchangeRates,
  target: Currency,
  currencies: readonly Currency[]
): string[] {
  const targetRate = rates.rates[target];
  if (!targetRate) return [];
  return currencies.flatMap((code) => {
    const rate = rates.rates[code];
    if (code === target || !rate) return [];
    const value = Number(targetRate) / Number(rate);
    return [
      `1 ${formatCurrency(code)} = ${rateFormatter.format(value)} ${formatCurrency(target)}`,
    ];
  });
}

export function CurrencySelect() {
  const currency = useCurrencyStore((state) => state.currency);
  const currencies = useEnabledCurrencies();
  const hasHydrated = useCurrencyStore((state) => state.hasHydrated);
  const updateSettings = useSettingsStore((state) => state.update);
  const rates = useExchangeRatesStore((state) => state.rates);
  const ratesStatus = useExchangeRatesStore((state) => state.status);
  const loadRates = useExchangeRatesStore((state) => state.load);

  // Same size as the real trigger, so the header doesn't shift on hydration.
  if (!hasHydrated) {
    return (
      <Button variant="ghost" size="sm" className="gap-1" disabled>
        <span className="invisible">{formatCurrency(DEFAULT_CURRENCY)}</span>
        <ChevronDown className="invisible size-4" />
      </Button>
    );
  }

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) void loadRates();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1"
          aria-label={`Display currency: ${formatCurrency(currency)}`}
        >
          {formatCurrency(currency)}
          <ChevronDown className="size-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Show amounts in</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={currency}
          onValueChange={(value) => {
            if (!isCurrency(value) || value === currency) return;
            // Saved as the user's setting; `features/settings/sync` copies it
            // into the currency store as soon as the change is made.
            updateSettings({ currency: value }).catch((err: unknown) => {
              toast.error(getErrorMessage(err));
            });
          }}
        >
          {currencies.map((code) => (
            <DropdownMenuRadioItem key={code} value={code}>
              {formatCurrency(code)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="space-y-0.5 text-xs font-normal text-muted-foreground">
          {rates ? (
            <>
              {describeRates(rates, currency, currencies).map((line) => (
                <p key={line} className="tabular-nums">
                  {line}
                </p>
              ))}
              <p>Rates of {formatDate(rates.date)}</p>
            </>
          ) : (
            <p>
              {ratesStatus === 'error'
                ? 'Exchange rates are unavailable'
                : 'Loading exchange rates…'}
            </p>
          )}
          <p>
            <a
              href="https://www.exchangerate-api.com"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Rates by ExchangeRate-API
            </a>
          </p>
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
