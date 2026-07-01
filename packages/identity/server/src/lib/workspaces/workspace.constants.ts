/**
 * The accent-color keys a workspace avatar may use. Mirrors the design-system
 * `AVATAR_COLORS` palette (backed by the host's `--color-avatar-*` tokens); it
 * is duplicated here because the server can't depend on the admin package, and
 * kept in sync by convention. DTOs whitelist `color` against this so an
 * arbitrary value can never be persisted and later cast to `AvatarColor`.
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
export type WorkspaceColor = (typeof WORKSPACE_COLORS)[number];
