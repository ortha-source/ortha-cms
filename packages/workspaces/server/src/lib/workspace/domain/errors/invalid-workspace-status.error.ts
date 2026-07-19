/**
 * Raised by {@link WorkspaceStatus.create} when a value isn't a known lifecycle
 * key. Transport-agnostic — an internal guard, since the status only ever comes
 * from trusted call sites (the archive / unarchive routes).
 */
export class InvalidWorkspaceStatusError extends Error {
    constructor(public readonly value: string) {
        super(`Invalid workspace status: ${value}`);
        this.name = 'InvalidWorkspaceStatusError';
    }
}
