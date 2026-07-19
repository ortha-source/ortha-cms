/**
 * A membership inside the {@link Workspace} aggregate — the link between a user
 * and the workspace. A pure link: it carries no role (a user's single global
 * role lives on the identity `users` table, unchanged by membership). Identified
 * within the aggregate by `userId` (a user joins a given workspace at most once).
 */
export class Membership {
    private constructor(private readonly memberUserId: string) {}

    /** Builds a membership linking `userId` to the owning workspace. */
    static create(userId: string): Membership {
        return new Membership(userId);
    }

    /** The linked user's id. */
    get userId(): string {
        return this.memberUserId;
    }
}
