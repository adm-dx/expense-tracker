import { AppHeader } from '@/widgets/app-header';
import { TransactionsSummary } from '@/widgets/transactions-summary';
import { TransactionsTable } from '@/widgets/transactions-table';
import { AddTransactionButton } from '@/features/transaction/upsert';
import { AuthGuard } from '@/entities/session';

export default function HomePage() {
  return (
    <AuthGuard>
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Transactions</h1>
          <AddTransactionButton />
        </div>
        <TransactionsSummary />
        <TransactionsTable />
      </main>
    </AuthGuard>
  );
}
