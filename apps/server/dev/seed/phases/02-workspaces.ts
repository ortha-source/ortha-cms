/**
 * Workspaces, who is in them, and which content types each one reaches.
 *
 * Membership is a yes/no gate with no role of its own — an admin outside a
 * workspace cannot open it either. A content type is reachable only through a
 * `workspace_content` grant: its own (`sourceWorkspaceId` null), or a shared
 * one that reads another workspace's **published** records, live only while
 * that source is shared, active and holds its own grant for the type.
 *
 * Written directly, as the e2e harness does: `isShared` and archiving are not
 * part of create, and an archived workspace with a dead shared grant is a state
 * no single request produces.
 */
import { eq } from 'drizzle-orm';
import {
    memberships,
    workspaceContent,
    workspaces
} from '@orthacms/workspaces-server';
import { contentTypes } from '../../../src/content';
import type { SeedContext } from '../context';

const ALL_TYPES = contentTypes.map((type) => type.name);

interface WorkspaceSpec {
    key: string;
    name: string;
    description: string;
    color: string;
    isShared: boolean;
    status: 'active' | 'archived';
    own: string[];
    /** Shared grants: `[source workspace key, type names]`. */
    shared: [string, string[]][];
    members: string[];
}

const WORKSPACES: WorkspaceSpec[] = [
    {
        key: 'main',
        name: 'Main',
        description: 'Every content type and almost every person. Start here.',
        color: 'violet',
        isShared: false,
        status: 'active',
        own: ALL_TYPES,
        shared: [],
        members: [
            'admin',
            'admin2',
            'editor',
            'editor2',
            'reviewer',
            'nodelete',
            'disabled',
            'reset',
            'sso'
        ]
    },
    {
        key: 'library',
        name: 'Library',
        description:
            'Shared: lends its published rel_target and i18n_target records to Consumer.',
        color: 'green',
        isShared: true,
        status: 'active',
        own: ['rel_target', 'i18n_target'],
        shared: [],
        members: ['admin']
    },
    {
        key: 'consumer',
        name: 'Consumer',
        description:
            "Links to Library's shared records; also holds a dead grant from Archived.",
        color: 'amber',
        isShared: false,
        status: 'active',
        own: ['rel_many_to_one', 'rel_many_to_many'],
        shared: [
            ['library', ['rel_target', 'i18n_target']],
            ['archived', ['rel_target']]
        ],
        members: ['admin', 'editor', 'viewer', 'invited']
    },
    {
        key: 'archived',
        name: 'Archived',
        description: 'Shared but archived: its records reach nobody.',
        color: 'rose',
        isShared: true,
        status: 'archived',
        own: ['rel_target'],
        shared: [],
        members: ['admin']
    },
    {
        key: 'empty',
        name: 'Empty',
        description: 'No content types granted: every type answers 404.',
        color: 'slate',
        isShared: false,
        status: 'active',
        own: [],
        shared: [],
        members: ['admin']
    }
];

export async function seedWorkspaces(ctx: SeedContext): Promise<void> {
    const db = ctx.db;
    const kinds = new Map(contentTypes.map((type) => [type.name, type.kind]));
    const kindOf = (slug: string) => {
        const kind = kinds.get(slug);
        if (!kind) throw new Error(`[seed] no content type "${slug}" to grant`);
        return kind;
    };

    for (const spec of WORKSPACES) {
        const [row] = await db
            .insert(workspaces)
            .values({
                name: spec.name,
                slug: spec.key,
                description: spec.description,
                color: spec.color,
                isShared: spec.isShared
            })
            .returning();
        ctx.workspaces.set(spec.key, {
            id: row.id,
            slug: row.slug,
            name: row.name
        });
    }

    for (const spec of WORKSPACES) {
        const workspaceId = ctx.workspace(spec.key).id;
        const grants = [
            ...spec.own.map((slug) => ({
                workspaceId,
                slug,
                kind: kindOf(slug),
                sourceWorkspaceId: null
            })),
            ...spec.shared.flatMap(([source, slugs]) =>
                slugs.map((slug) => ({
                    workspaceId,
                    slug,
                    kind: kindOf(slug),
                    sourceWorkspaceId: ctx.workspace(source).id
                }))
            )
        ];
        if (grants.length) await db.insert(workspaceContent).values(grants);

        // The `.env` root admin, when there is one, joins everything too.
        const members = [
            ...spec.members,
            ...(ctx.users.has('root') ? ['root'] : [])
        ];
        await db.insert(memberships).values(
            members.map((key) => ({
                userId: ctx.user(key).id,
                workspaceId
            }))
        );
    }

    ctx.section('Workspaces', [
        '| workspace | shared | status | own types | shared in | members |',
        '|---|---|---|---|---|---|',
        ...WORKSPACES.map(
            (w) =>
                `| ${w.name} | ${w.isShared ? 'yes' : 'no'} | ${w.status} | ${w.own.length === ALL_TYPES.length ? 'all' : w.own.join(', ') || '—'} | ${w.shared.map(([s, t]) => `${t.join(', ')} from ${s}`).join('; ') || '—'} | ${w.members.join(', ')} |`
        )
    ]);
}

/**
 * Archiving waits for the content phase: an archived workspace refuses writes,
 * and Archived needs a published record for its dead shared grant to hide.
 */
export async function archiveWorkspaces(ctx: SeedContext): Promise<void> {
    for (const spec of WORKSPACES.filter((w) => w.status === 'archived')) {
        await ctx.db
            .update(workspaces)
            .set({ status: 'archived' })
            .where(eq(workspaces.id, ctx.workspace(spec.key).id));
    }
}
