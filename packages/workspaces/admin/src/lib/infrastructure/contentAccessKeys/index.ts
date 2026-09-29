/**
 * Query keys for everything that answers **"which content can this workspace
 * reach, and from where?"** — the shared-sources catalogue here, and (built on
 * {@link workspaceContentAccessKey}, exported through the barrel) the Content
 * Library's content-type list, whose `access` is computed per workspace.
 *
 * One root, so a grant change invalidates exactly this family for exactly one
 * workspace: the workspaces list refetches for the grant rows, and these for
 * the nav, the records views and the relation picker — nothing else. Kept off
 * the `['workspaces']` root on purpose: every profile or member mutation
 * invalidates that one, and none of them changes what content is reachable.
 */

/** Every workspace's content-access queries. */
export const workspaceContentAccessRoot = ['workspace-content-access'] as const;

/** One workspace's content-access queries. */
export const workspaceContentAccessKey = (workspaceId: string | null) =>
    [...workspaceContentAccessRoot, workspaceId] as const;

/** The shared workspaces (and their types) one workspace can be granted from. */
export const sharedSourcesKey = (workspaceId: string) =>
    [...workspaceContentAccessKey(workspaceId), 'shared-sources'] as const;
