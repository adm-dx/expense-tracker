import type { Metadata } from 'next';
import { AppHeader } from '@/widgets/app-header';
import { AuthGuard } from '@/entities/session';

export const metadata: Metadata = {
  title: 'Categories',
};

export default function CategoriesPage() {
  return (
    <AuthGuard>
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-2 px-4 py-8">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <p className="text-muted-foreground">
          Category management is coming soon.
        </p>
      </main>
    </AuthGuard>
  );
}
