export interface RemoveTagFromTransactionsResult {
  /** How many transactions lost the tag. */
  updated: number;
}

/** Strips the tag from every transaction of the user, in one statement. */
export class RemoveTagFromTransactionsCommand {
  constructor(
    public readonly userId: string,
    public readonly tagId: string
  ) {}
}
