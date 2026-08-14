/**
 * Field length limits for a workspace's profile, mirroring the server DTOs —
 * `CreateWorkspaceDto` / `UpdateWorkspaceDto` (`@MaxLength(120)` on `name`,
 * `@MaxLength(2000)` on `description`).
 *
 * They live in `domain/` as one shared constant because they were previously
 * duplicated across four sites (two Zod schema hooks and two components' local
 * `NAME_MAX`/`DESCRIPTION_MAX`), all four of which had drifted to 100/500 while
 * claiming in their docstrings to mirror the server. A client stricter than the
 * server is not merely conservative here: a workspace whose name is 101–120
 * characters — legal, and creatable through the public API, MCP, the copilot or
 * a seed — made the settings form permanently invalid, disabling Save for the
 * description and accent colour too, with `maxLength` preventing the user from
 * even retyping the original value.
 *
 * Slug length is *not* here: it belongs to the {@link Slug} value object, which
 * already mirrors the server's 120 correctly.
 */

/** Longest workspace name the server accepts. */
export const NAME_MAX = 120;

/** Longest workspace description the server accepts. */
export const DESCRIPTION_MAX = 2000;
