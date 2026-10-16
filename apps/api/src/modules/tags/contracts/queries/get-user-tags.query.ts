export interface UserTag {
  id: string;
  name: string;
}

/** Every tag of the user (`UserTag[]`), ordered by name. */
export class GetUserTagsQuery {
  constructor(public readonly userId: string) {}
}
