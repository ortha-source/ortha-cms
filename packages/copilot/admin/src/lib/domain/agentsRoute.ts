/**
 * Where the Agents view lives, as pure functions over a pathname.
 *
 * Framework-free and unit-tested, for the same reason `readRouteContext` is:
 * three separate places have to agree about what "inside the Agents view" means
 * — the plugin that mounts the route, the sidebar switcher that toggles into it,
 * and the dock that stands down while it is open — and a regex copy-pasted three
 * times is three chances to disagree.
 */

/** The workspace-relative segment the Agents view is mounted at. */
export const AGENTS_SEGMENT = 'agents';

/**
 * The sub-segment the skills management page is mounted at.
 *
 * **Reserved**: it sits in the same slot a `:conversationId` occupies, so
 * `readAgentThreadId` excludes it explicitly. React Router ranks the literal
 * `agents/skills` above the `agents/*` wildcard and the thread page never
 * renders there — but that is a fact about the router's ranking, and the page
 * would otherwise try to fetch a conversation called "skills" if it ever
 * changed.
 */
export const SKILLS_SEGMENT = 'skills';

/**
 * The permission the whole copilot surface is gated on — the launcher, the
 * sidebar switcher, and the Agents page alike. It mirrors the server's gate
 * rather than replacing it; every route enforces it regardless.
 */
export const COPILOT_USE = 'copilot:use';

/**
 * The permission the skills management page is gated on — admin-only.
 *
 * Separate from {@link COPILOT_USE} because using a skill and writing one are
 * different acts: a skill's instructions are prompt text that runs for everyone
 * in the workspace, so authoring is configuration
 * ([ADR-0010](../../../../../docs/adr/0010-copilot-skills.md)).
 */
export const COPILOT_SKILLS_MANAGE = 'copilot:skills:manage';

/** The Agents view's base path — an unsaved new chat. */
export function agentsPath(workspaceId: string): string {
    return `/workspaces/${workspaceId}/${AGENTS_SEGMENT}`;
}

/** Where one saved thread is deep-linked. */
export function agentThreadPath(
    workspaceId: string,
    conversationId: string
): string {
    return `${agentsPath(workspaceId)}/${conversationId}`;
}

/** Where the workspace's skills are managed. */
export function agentSkillsPath(workspaceId: string): string {
    return `${agentsPath(workspaceId)}/${SKILLS_SEGMENT}`;
}

/** Whether a pathname is inside the Agents view of some workspace. */
export function isAgentsPath(pathname: string): boolean {
    const segments = pathname.split('/').filter(Boolean);
    return (
        segments[0] === 'workspaces' &&
        !!segments[1] &&
        segments[2] === AGENTS_SEGMENT
    );
}

/**
 * The thread the URL points at, or `null` for the unsaved new chat at the base.
 *
 * **The Agents page reads its open thread from here rather than from a nested
 * `<Route path=":conversationId">`.** That is not a style preference: the first
 * turn of a new chat mints a thread id and rewrites the URL from the base to the
 * thread path, and with two route elements React Router would unmount one and
 * mount the other *mid-stream* — which aborts the very run that produced the id.
 * One always-mounted component reading the id off the location has no such seam.
 */
export function readAgentThreadId(pathname: string): string | null {
    const segments = pathname.split('/').filter(Boolean);
    if (
        segments[0] !== 'workspaces' ||
        !segments[1] ||
        segments[2] !== AGENTS_SEGMENT
    ) {
        return null;
    }
    // The skills page shares this slot with a thread id and is not one.
    if (segments[3] === SKILLS_SEGMENT) {
        return null;
    }
    return segments[3] ?? null;
}
