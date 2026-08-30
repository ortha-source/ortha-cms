/** A workspace as the endpoint editor's picker renders it. */
export type WorkspaceOption = {
    id: string;
    name: string;
    description: string | null;
    /**
     * The content-type slugs this workspace was granted (`workspace_content`).
     *
     * Empty means **granted nothing**, never "no filtering" — the same rule the
     * server's own `WorkspaceGrantsQuery` states. The editor narrows its type
     * picker to the union of the chosen workspaces' grants, because a type this
     * workspace cannot hold can never produce an event here.
     */
    contentTypes: string[];
};
