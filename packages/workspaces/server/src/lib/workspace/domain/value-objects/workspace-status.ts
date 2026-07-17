import { InvalidWorkspaceStatusError } from '../errors';

/** The lifecycle states a workspace can be in. */
export const WORKSPACE_STATUSES = ['active', 'archived'] as const;

/** One of the {@link WORKSPACE_STATUSES} lifecycle keys. */
export type WorkspaceStatusKey = (typeof WORKSPACE_STATUSES)[number];

/**
 * A workspace's lifecycle status. New workspaces start `active`; archiving is a
 * soft state change (nothing is deleted).
 */
export class WorkspaceStatus {
    private constructor(private readonly status: WorkspaceStatusKey) {}

    /** The `active` status. */
    static active(): WorkspaceStatus {
        return new WorkspaceStatus('active');
    }

    /** The `archived` status. */
    static archived(): WorkspaceStatus {
        return new WorkspaceStatus('archived');
    }

    /**
     * Builds a {@link WorkspaceStatus} from a raw key, rejecting an unknown one
     * with {@link InvalidWorkspaceStatusError}.
     */
    static create(value: string): WorkspaceStatus {
        if (!WORKSPACE_STATUSES.includes(value as WorkspaceStatusKey)) {
            throw new InvalidWorkspaceStatusError(value);
        }
        return new WorkspaceStatus(value as WorkspaceStatusKey);
    }

    /** The underlying status key. */
    get value(): WorkspaceStatusKey {
        return this.status;
    }

    /** Whether this is the `archived` state. */
    get isArchived(): boolean {
        return this.status === 'archived';
    }

    /** Structural equality on the underlying key. */
    equals(other: WorkspaceStatus): boolean {
        return this.status === other.status;
    }
}
