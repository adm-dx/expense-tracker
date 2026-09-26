import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Categories',
};

export default function CategoriesPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Categories</h1>
      <p className="text-muted-foreground">
        Category management is coming soon.
      </p>
    </div>
  );
}
