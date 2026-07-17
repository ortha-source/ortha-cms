import { InvalidWorkspaceColorError } from '../errors';

/**
 * The accent-color keys a workspace avatar may use. Mirrors the design-system
 * `AVATAR_COLORS` palette (backed by the host's `--color-avatar-*` tokens); it
 * is duplicated here because the server can't depend on the admin package, and
 * kept in sync by convention.
 */
export const WORKSPACE_COLORS = [
    'slate',
    'green',
    'amber',
    'violet',
    'rose',
    'teal',
    'indigo'
] as const;

/** One of the {@link WORKSPACE_COLORS} accent keys. */
export type WorkspaceColorKey = (typeof WORKSPACE_COLORS)[number];

/** The accent color applied when a workspace is created without an explicit one. */
const DEFAULT_COLOR: WorkspaceColorKey = 'slate';

/**
 * A workspace's accent color, constrained to the {@link WORKSPACE_COLORS}
 * palette so an arbitrary value can never be persisted and later cast to an
 * `AvatarColor` in the admin.
 */
export class WorkspaceColor {
    private constructor(private readonly color: WorkspaceColorKey) {}

    /**
     * Builds a {@link WorkspaceColor}, rejecting a value outside the palette
     * with {@link InvalidWorkspaceColorError}.
     */
    static create(value: string): WorkspaceColor {
        if (!WORKSPACE_COLORS.includes(value as WorkspaceColorKey)) {
            throw new InvalidWorkspaceColorError(value);
        }
        return new WorkspaceColor(value as WorkspaceColorKey);
    }

    /** The palette default (`slate`). */
    static default(): WorkspaceColor {
        return new WorkspaceColor(DEFAULT_COLOR);
    }

    /** The underlying color key. */
    get value(): WorkspaceColorKey {
        return this.color;
    }
}
