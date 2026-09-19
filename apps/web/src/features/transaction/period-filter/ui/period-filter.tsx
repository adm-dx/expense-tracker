'use client';

import { useTransactionsStore } from '@/entities/transaction';
import {
  getPresetPeriod,
  PERIOD_PRESETS,
  type PeriodPreset,
} from '@/shared/lib/period';
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui';

export function PeriodFilter() {
  const period = useTransactionsStore((state) => state.period);
  const preset = useTransactionsStore((state) => state.preset);
  const setPeriod = useTransactionsStore((state) => state.setPeriod);

  function handlePresetChange(value: string) {
    const next = value as PeriodPreset;
    // "Custom" keeps the current dates and just unlocks the inputs.
    setPeriod(next === 'custom' ? period : getPresetPeriod(next), next);
  }

  function handleDateChange(bound: 'dateFrom' | 'dateTo', value: string) {
    // `min`/`max` only mark the input invalid, so an inverted range still
    // reaches here (e.g. typing a year); drag the other bound along instead
    // of asking the API for a range it rejects.
    if (!value) return;
    const next =
      bound === 'dateFrom'
        ? {
            dateFrom: value,
            dateTo: value > period.dateTo ? value : period.dateTo,
          }
        : {
            dateFrom: value < period.dateFrom ? value : period.dateFrom,
            dateTo: value,
          };
    setPeriod(next, 'custom');
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="period-preset">Period</Label>
        <Select value={preset} onValueChange={handlePresetChange}>
          <SelectTrigger id="period-preset" className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_PRESETS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="period-from">From</Label>
        <Input
          id="period-from"
          type="date"
          className="w-[160px]"
          value={period.dateFrom}
          max={period.dateTo}
          onChange={(event) => handleDateChange('dateFrom', event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="period-to">To</Label>
        <Input
          id="period-to"
          type="date"
          className="w-[160px]"
          value={period.dateTo}
          min={period.dateFrom}
          onChange={(event) => handleDateChange('dateTo', event.target.value)}
        />
      </div>
    </div>
  );
}
