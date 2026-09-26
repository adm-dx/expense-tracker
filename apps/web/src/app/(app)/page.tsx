import { TransactionsSummary } from '@/widgets/transactions-summary';
import { TransactionsTable } from '@/widgets/transactions-table';
import { AddTransactionButton } from '@/features/transaction/upsert';

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <AddTransactionButton />
      </div>
      <TransactionsSummary />
      <TransactionsTable />
    </div>
  );
}
