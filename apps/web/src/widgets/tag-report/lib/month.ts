const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** `2026-01` as "Jan 2026"; the months of the report are UTC months. */
export function formatMonth(month: string): string {
  return monthFormatter.format(new Date(`${month}-01T00:00:00.000Z`));
}
