import type { Metadata } from 'next';
import { CategoriesList } from '@/widgets/categories-list';
import { AddCategoryButton } from '@/features/category/upsert';

export const metadata: Metadata = {
  title: 'Categories',
};

export default function CategoriesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <AddCategoryButton />
      </div>
      <CategoriesList />
    </div>
  );
}
