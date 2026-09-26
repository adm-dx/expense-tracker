/** Replaces the user's password hash; the caller hashes the new password. */
export class ChangeUserPasswordCommand {
  constructor(
    public readonly userId: string,
    public readonly passwordHash: string,
  ) {}
}
