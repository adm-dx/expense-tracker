'use client';

import { useTransactionsStore } from '@/entities/transaction';
import { PeriodPicker } from '@/shared/ui';

/** The period shared by the transactions table and the summary cards. */
export function PeriodFilter() {
  const period = useTransactionsStore((state) => state.period);
  const preset = useTransactionsStore((state) => state.preset);
  const setPeriod = useTransactionsStore((state) => state.setPeriod);

  return <PeriodPicker period={period} preset={preset} onChange={setPeriod} />;
}
