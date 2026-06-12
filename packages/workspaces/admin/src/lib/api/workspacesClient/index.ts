import { AVATAR_COLORS, type AvatarColor } from '@ortha-cms/design-system';
import type { Workspace, WorkspaceMember } from '../../types/workspace';
import type { CreateWorkspaceBody } from '../../types/wizard';
import { slugify } from '../../utils/slugify';
import { initialsOf } from '../../utils/initialsOf';

// TODO(workspaces-server): replace this in-memory stub with `apiClient` calls
// against `/api/workspaces` (list, create, and `GET /slug-available`) once a
// workspaces server plugin ships the rich shape (members, roles, color, status,
// content access). The exported function signatures are the contract the real
// client must satisfy — nothing else in the admin imports the store.

const member = (
    id: string,
    name: string,
    email: string,
    color: AvatarColor
): WorkspaceMember => ({
    id,
    name,
    email,
    color,
    initials: initialsOf(name)
});

let store: Workspace[] = [
    {
        id: 'ws_marketing',
        name: 'Marketing site',
        description:
            'Landing pages, the blog, and campaign content for the public website.',
        color: 'violet',
        status: 'Active',
        members: [
            member('u_ada', 'Ada Lovelace', 'ada@ortha.dev', 'violet'),
            member('u_grace', 'Grace Hopper', 'grace@ortha.dev', 'teal'),
            member('u_alan', 'Alan Turing', 'alan@ortha.dev', 'slate')
        ]
    },
    {
        id: 'ws_docs',
        name: 'Product docs',
        description:
            'Guides, API references, and release notes for the developer portal.',
        color: 'teal',
        status: 'Active',
        members: [
            member('u_grace', 'Grace Hopper', 'grace@ortha.dev', 'teal'),
            member('u_linus', 'Linus Torvalds', 'linus@ortha.dev', 'green'),
            member(
                'u_margaret',
                'Margaret Hamilton',
                'margaret@ortha.dev',
                'rose'
            ),
            member('u_dennis', 'Dennis Ritchie', 'dennis@ortha.dev', 'amber'),
            member(
                'u_katherine',
                'Katherine Johnson',
                'katherine@ortha.dev',
                'indigo'
            )
        ]
    },
    {
        id: 'ws_support',
        name: 'Support hub',
        description:
            'Help-center articles and canned responses shared across the support team.',
        color: 'green',
        status: 'Active',
        members: [
            member(
                'u_margaret',
                'Margaret Hamilton',
                'margaret@ortha.dev',
                'rose'
            ),
            member('u_alan', 'Alan Turing', 'alan@ortha.dev', 'slate')
        ]
    },
    {
        id: 'ws_internal',
        name: 'Internal wiki',
        description:
            'Team handbook, onboarding, and process docs for employees only.',
        color: 'amber',
        status: 'Active',
        members: [
            member('u_ada', 'Ada Lovelace', 'ada@ortha.dev', 'violet'),
            member('u_dennis', 'Dennis Ritchie', 'dennis@ortha.dev', 'amber'),
            member('u_grace', 'Grace Hopper', 'grace@ortha.dev', 'teal'),
            member(
                'u_katherine',
                'Katherine Johnson',
                'katherine@ortha.dev',
                'indigo'
            )
        ]
    },
    {
        id: 'ws_research',
        name: 'Research archive',
        description:
            'Retired experiments and old design explorations kept for reference.',
        color: 'slate',
        status: 'Archived',
        members: [member('u_alan', 'Alan Turing', 'alan@ortha.dev', 'slate')]
    },
    {
        id: 'ws_events_2023',
        name: 'Events 2023',
        description:
            'Last year’s conference microsites and event landing pages, now archived.',
        color: 'rose',
        status: 'Archived',
        members: [
            member(
                'u_katherine',
                'Katherine Johnson',
                'katherine@ortha.dev',
                'indigo'
            ),
            member('u_linus', 'Linus Torvalds', 'linus@ortha.dev', 'green')
        ]
    }
];

/**
 * Arguments to {@link createWorkspace}: the API request body plus the creator,
 * which the stub uses to seed the workspace's owner. The real server will
 * derive the owner from the session and ignore `creator`.
 */
export type CreateWorkspaceArgs = {
    body: CreateWorkspaceBody;
    creator: WorkspaceMember;
};

/** Lists every workspace. */
export async function listWorkspaces(): Promise<Workspace[]> {
    return structuredClone(store);
}

/**
 * Whether `slug` is free. The stub treats the slugified name of every existing
 * workspace as taken, so e.g. `marketing-site` reports unavailable.
 */
export async function checkSlugAvailable(slug: string): Promise<boolean> {
    const taken = new Set(store.map((w) => slugify(w.name)));
    return !taken.has(slug);
}

/** Creates a workspace (Active) with the creator as owner plus any added members. */
export async function createWorkspace({
    body,
    creator
}: CreateWorkspaceArgs): Promise<Workspace> {
    const added = body.members.map((m, i) =>
        member(
            m.id,
            m.invited ? m.email : m.name,
            m.email,
            AVATAR_COLORS[i % AVATAR_COLORS.length]
        )
    );
    const created: Workspace = {
        id: `ws_${body.slug}_${store.length}`,
        name: body.name,
        description: body.description,
        color: body.color,
        status: 'Active',
        members: [creator, ...added]
    };
    store = [created, ...store];
    return structuredClone(created);
}
