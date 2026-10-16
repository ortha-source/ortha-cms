/**
 * Roles and people. Roles are **global** — one per user — and say what a person
 * may do; which workspaces they reach is membership, seeded in the next phase.
 *
 * Users are inserted directly, as the e2e harness does, with the password
 * hashed by the app's own `HashingService`: the invite use case would send
 * mail and leave every account pending, and there is no API that writes an
 * `active` user with a known password, which is the point of a dev account.
 */
import { eq, inArray } from 'drizzle-orm';
import {
    permissions,
    rolePermissions,
    roles,
    ssoIdentities,
    tokens,
    users
} from '@orthacms/identity-server';
import { HashingService } from '../../../../../packages/identity/server/src/lib/auth/services/hashing.service';
import {
    ADMIN_URL,
    DEV_PASSWORD,
    daysFromNow,
    devSecret,
    sha256Hex,
    type SeedContext
} from '../context';

type RoleKey = 'admin' | 'contributor' | 'viewer' | 'reviewer' | 'no_delete';
type Status = 'pending' | 'active' | 'disabled';

interface UserSpec {
    key: string;
    name: string;
    role: RoleKey;
    status: Status;
    /** `false` leaves `password_hash` null: an invitee, or an SSO-only user. */
    password: boolean;
    why: string;
}

const USERS: UserSpec[] = [
    {
        key: 'admin',
        name: 'Ada Admin',
        role: 'admin',
        status: 'active',
        password: true,
        why: 'The main account: a member of every workspace.'
    },
    {
        key: 'admin2',
        name: 'Alan Admin',
        role: 'admin',
        status: 'active',
        password: true,
        why: 'A second admin, so "the last admin cannot be demoted" can be tried — and is not hit.'
    },
    {
        key: 'editor',
        name: 'Edith Editor',
        role: 'contributor',
        status: 'active',
        password: true,
        why: 'An everyday contributor in `main` and `consumer`; a reviewer for protection.'
    },
    {
        key: 'editor2',
        name: 'Eric Editor',
        role: 'contributor',
        status: 'active',
        password: true,
        why: 'A second contributor: the "other person" a four-eyes rule needs.'
    },
    {
        key: 'viewer',
        name: 'Vera Viewer',
        role: 'viewer',
        status: 'active',
        password: true,
        why: 'Read-only, in `consumer` only.'
    },
    {
        key: 'reviewer',
        name: 'Rex Reviewer',
        role: 'reviewer',
        status: 'active',
        password: true,
        why: 'Custom role: may read and approve, nothing else.'
    },
    {
        key: 'nodelete',
        name: 'Nora Nodelete',
        role: 'no_delete',
        status: 'active',
        password: true,
        why: 'Custom role: a contributor without any delete permission.'
    },
    {
        key: 'homeless',
        name: 'Hugo Homeless',
        role: 'contributor',
        status: 'active',
        password: true,
        why: 'In no workspace: the empty states.'
    },
    {
        key: 'disabled',
        name: 'Dora Disabled',
        role: 'viewer',
        status: 'disabled',
        password: true,
        why: 'Suspended: cannot sign in; Enable is offered.'
    },
    {
        key: 'invited',
        name: 'Ivan Invited',
        role: 'contributor',
        status: 'pending',
        password: false,
        why: 'A pending invite with a live link.'
    },
    {
        key: 'expired',
        name: 'Ethel Expired',
        role: 'viewer',
        status: 'pending',
        password: false,
        why: 'A pending invite whose link has expired.'
    },
    {
        key: 'reset',
        name: 'Rita Reset',
        role: 'contributor',
        status: 'active',
        password: true,
        why: 'Active, with a live password-reset link.'
    },
    {
        key: 'sso',
        name: 'Sam Sso',
        role: 'viewer',
        status: 'active',
        password: false,
        why: 'Signed up through SSO (`oidc`): no password of their own.'
    }
];

/** Custom roles have no API: the users plugin assigns only the system three. */
const CUSTOM_ROLES: {
    key: RoleKey;
    name: string;
    base: 'contributor' | null;
    grant: string[];
    drop: string[];
}[] = [
    {
        key: 'reviewer',
        name: 'Reviewer',
        base: null,
        grant: [
            'workspaces:read',
            'users:read',
            'content:read',
            'content:approve',
            'media:read'
        ],
        drop: []
    },
    {
        key: 'no_delete',
        name: 'Contributor (no delete)',
        base: 'contributor',
        grant: [],
        drop: ['content:delete', 'media:delete']
    }
];

export const emailOf = (key: string): string => `${key}@dev.local`;

export async function seedIdentity(ctx: SeedContext): Promise<void> {
    const db = ctx.db;
    const roleIds = new Map<string, string>(
        (await db.select({ id: roles.id, key: roles.key }).from(roles)).map(
            (row) => [row.key, row.id]
        )
    );
    const permissionIds = new Map<string, string>(
        (
            await db
                .select({ id: permissions.id, key: permissions.key })
                .from(permissions)
        ).map((row) => [row.key, row.id])
    );

    for (const custom of CUSTOM_ROLES) {
        let keys = new Set(custom.grant);
        if (custom.base) {
            const baseKeys = await db
                .select({ key: permissions.key })
                .from(rolePermissions)
                .innerJoin(
                    permissions,
                    eq(permissions.id, rolePermissions.permissionId)
                )
                .where(
                    eq(rolePermissions.roleId, mustGet(roleIds, custom.base))
                );
            keys = new Set([
                ...baseKeys.map((row) => row.key),
                ...custom.grant
            ]);
        }
        for (const key of custom.drop) keys.delete(key);
        const [role] = await db
            .insert(roles)
            .values({ key: custom.key, name: custom.name, isSystem: false })
            .returning({ id: roles.id });
        roleIds.set(custom.key, role.id);
        await db.insert(rolePermissions).values(
            [...keys].map((key) => ({
                roleId: role.id,
                permissionId: mustGet(permissionIds, key)
            }))
        );
    }

    const hashing = ctx.get(HashingService);
    const passwordHash = await hashing.hashPassword(DEV_PASSWORD);
    for (const spec of USERS) {
        const [user] = await db
            .insert(users)
            .values({
                email: emailOf(spec.key),
                name: spec.name,
                passwordHash: spec.password ? passwordHash : null,
                roleId: mustGet(roleIds, spec.role),
                status: spec.status
            })
            .returning();
        ctx.users.set(spec.key, { ...user, key: spec.key });
    }

    // The root admin from `.env` (if any) is seeded at boot by RootAdminSeeder;
    // pick it up so the workspaces phase can make it a member everywhere too.
    const rootEmail = process.env['ORTHACMS_ROOT_ADMIN_EMAIL']
        ?.trim()
        .toLowerCase();
    if (rootEmail) {
        const [root] = await db
            .select()
            .from(users)
            .where(eq(users.email, rootEmail));
        if (root) ctx.users.set('root', { ...root, key: 'root' });
    }

    // Invite and reset links. Raw tokens are derived from a label so the links
    // survive a reset; only their SHA-256 is stored, exactly as the app does.
    const invite = devSecret('invite:invited');
    const expiredInvite = devSecret('invite:expired');
    const reset = devSecret('reset:reset');
    await db.insert(tokens).values([
        {
            type: 'invite',
            userId: ctx.user('invited').id,
            tokenHash: sha256Hex(invite),
            expiresAt: daysFromNow(7)
        },
        {
            type: 'invite',
            userId: ctx.user('expired').id,
            tokenHash: sha256Hex(expiredInvite),
            expiresAt: daysFromNow(-1),
            createdAt: daysFromNow(-8)
        },
        {
            type: 'reset',
            userId: ctx.user('reset').id,
            tokenHash: sha256Hex(reset),
            expiresAt: daysFromNow(30)
        }
    ]);

    await db.insert(ssoIdentities).values({
        userId: ctx.user('sso').id,
        provider: 'oidc',
        subject: 'dev-oidc-subject-sam',
        email: emailOf('sso'),
        lastLoginAt: daysFromNow(-2)
    });

    const custom = await db
        .select({ key: roles.key })
        .from(roles)
        .where(inArray(roles.key, ['reviewer', 'no_delete']));
    ctx.section('Accounts', [
        `Password for every account that has one: \`${DEV_PASSWORD}\``,
        '',
        '| email | role | status | why |',
        '|---|---|---|---|',
        ...USERS.map(
            (u) =>
                `| \`${emailOf(u.key)}\` | ${u.role} | ${u.status} | ${u.why} |`
        ),
        '',
        `Custom roles: ${custom.map((r) => `\`${r.key}\``).join(', ')}.`,
        '',
        `- Accept invite (\`invited@\`): ${ADMIN_URL}/identity/accept-invite?token=${invite}`,
        `- Expired invite (\`expired@\`): ${ADMIN_URL}/identity/accept-invite?token=${expiredInvite}`,
        `- Reset password (\`reset@\`): ${ADMIN_URL}/identity/reset-password?token=${reset}`
    ]);
}

function mustGet(map: Map<string, string>, key: string): string {
    const value = map.get(key);
    if (!value)
        throw new Error(
            `[seed] "${key}" not found — are the system roles seeded?`
        );
    return value;
}
