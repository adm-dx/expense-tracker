import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reports',
};

export default function ReportsPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <p className="text-muted-foreground">Reports are coming soon.</p>
    </div>
  );
}
