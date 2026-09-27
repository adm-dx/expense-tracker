'use client';

import { useId } from 'react';
import {
  getPresetPeriod,
  PERIOD_PRESETS,
  type Period,
  type PeriodPreset,
} from '@/shared/lib/period';
import { Input } from './input';
import { Label } from './label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

interface PeriodPickerProps {
  period: Period;
  preset: PeriodPreset;
  onChange: (period: Period, preset: PeriodPreset) => void;
}

/** A preset list plus From/To dates; the owner keeps the state. */
export function PeriodPicker({ period, preset, onChange }: PeriodPickerProps) {
  // Unique ids, so two pickers can share a page.
  const id = useId();

  function handlePresetChange(value: string) {
    const next = value as PeriodPreset;
    // "Custom" keeps the current dates and just unlocks the inputs.
    onChange(next === 'custom' ? period : getPresetPeriod(next), next);
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
    onChange(next, 'custom');
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-preset`}>Period</Label>
        <Select value={preset} onValueChange={handlePresetChange}>
          <SelectTrigger id={`${id}-preset`} className="w-[160px]">
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
        <Label htmlFor={`${id}-from`}>From</Label>
        <Input
          id={`${id}-from`}
          type="date"
          className="w-[160px]"
          value={period.dateFrom}
          max={period.dateTo}
          onChange={(event) => handleDateChange('dateFrom', event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-to`}>To</Label>
        <Input
          id={`${id}-to`}
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
