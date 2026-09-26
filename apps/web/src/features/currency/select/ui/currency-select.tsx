'use client';

import {
  CURRENCIES,
  type Currency,
  type ExchangeRates,
} from '@expense-tracker/types';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useCurrencyStore, useExchangeRatesStore } from '@/entities/currency';
import { useSettingsStore } from '@/entities/settings';
import { getErrorMessage } from '@/shared/lib/error';
import { formatDate } from '@/shared/lib/format';
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

function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

/** "1 EUR = 117.5 RSD" for every other currency, priced in `target`. */
function describeRates(rates: ExchangeRates, target: Currency): string[] {
  const targetRate = Number(rates.rates[target]);
  return CURRENCIES.filter((code) => code !== target).map((code) => {
    const value = targetRate / Number(rates.rates[code]);
    return `1 ${code} = ${rateFormatter.format(value)} ${target}`;
  });
}

export function CurrencySelect() {
  const currency = useCurrencyStore((state) => state.currency);
  const hasHydrated = useCurrencyStore((state) => state.hasHydrated);
  const updateSettings = useSettingsStore((state) => state.update);
  const rates = useExchangeRatesStore((state) => state.rates);
  const ratesStatus = useExchangeRatesStore((state) => state.status);
  const loadRates = useExchangeRatesStore((state) => state.load);

  // Same size as the real trigger, so the header doesn't shift on hydration.
  if (!hasHydrated) {
    return (
      <Button variant="ghost" size="sm" className="w-[76px]" disabled>
        <span className="invisible">RSD</span>
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
          className="w-[76px] gap-1"
          aria-label={`Display currency: ${currency}`}
        >
          {currency}
          <ChevronDown className="size-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
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
          {CURRENCIES.map((code) => (
            <DropdownMenuRadioItem key={code} value={code}>
              {code}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="space-y-0.5 text-xs font-normal text-muted-foreground">
          {rates ? (
            <>
              {describeRates(rates, currency).map((line) => (
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
