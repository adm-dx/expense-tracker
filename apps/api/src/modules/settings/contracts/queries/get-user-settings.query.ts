/** The user's settings (`UserSettings`), the defaults when there are none. */
export class GetUserSettingsQuery {
  constructor(public readonly userId: string) {}
}
