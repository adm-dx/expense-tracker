import type { Metadata } from 'next';
import { CategoryReport } from '@/widgets/category-report';

export const metadata: Metadata = {
  title: 'Reports',
};

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <CategoryReport />
    </div>
  );
}
