import type { Metadata } from 'next';
import { CategoryReport } from '@/widgets/category-report';
import { TagReport } from '@/widgets/tag-report';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui';

export const metadata: Metadata = {
  title: 'Reports',
};

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <Tabs defaultValue="category" className="space-y-4">
        <TabsList>
          <TabsTrigger value="category">By category</TabsTrigger>
          <TabsTrigger value="tag">By tag</TabsTrigger>
        </TabsList>
        <TabsContent value="category">
          <CategoryReport />
        </TabsContent>
        <TabsContent value="tag">
          <TagReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
