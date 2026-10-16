/** Tag id to how many of the user's transactions carry it; absent means 0. */
export type TransactionCountByTag = Record<string, number>;

/** Counts the user's transactions per tag (`TransactionCountByTag`). */
export class CountTransactionsByTagQuery {
  constructor(public readonly userId: string) {}
}
