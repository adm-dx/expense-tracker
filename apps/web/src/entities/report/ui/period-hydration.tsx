'use client';

import { useEffect } from 'react';
import { useCategoryReportStore } from '../model/category-report-store';

/** Reads the stored period of the reports page back, once per tab. */
export function ReportPeriodHydration() {
  useEffect(() => {
    void useCategoryReportStore.persist.rehydrate();
  }, []);

  return null;
}
