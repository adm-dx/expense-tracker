/** Stores the default settings for a new user; a no-op if they have some. */
export class CreateDefaultSettingsCommand {
  constructor(public readonly userId: string) {}
}
