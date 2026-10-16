/**
 * API tokens in every state the tokens page shows. Minted through
 * `ApiTokenService`, which returns each secret exactly once — so the seed
 * prints them to `.output.md`. Expired and revoked are set on the row
 * afterwards: the API refuses a past expiry, and revoking happens elsewhere.
 *
 * A `full` token also authenticates the MCP endpoint (`MCP_ENABLED=true`).
 */
import { eq } from 'drizzle-orm';
import { ApiTokenService, apiTokens } from '@orthacms/identity-server';
import { daysFromNow, type SeedContext } from '../context';

export async function seedApiTokens(ctx: SeedContext): Promise<void> {
    const service = ctx.get(ApiTokenService);
    const admin = ctx.user('admin');
    const lines: string[] = [
        '| name | scope | workspaces | state | secret |',
        '|---|---|---|---|---|'
    ];

    const mint = async (
        name: string,
        scope: 'read' | 'full',
        workspaces: string[],
        state: 'active' | 'expiring' | 'expired' | 'revoked'
    ) => {
        const { token, secret } = await service.mint({
            name,
            scope,
            workspaceIds: workspaces.map((key) => ctx.workspace(key).id),
            expiresAt: state === 'expiring' ? daysFromNow(5) : null,
            createdBy: admin.id
        });
        if (state === 'expired') {
            await ctx.db
                .update(apiTokens)
                .set({ expiresAt: daysFromNow(-1) })
                .where(eq(apiTokens.id, token.id));
        }
        if (state === 'revoked') {
            await ctx.db
                .update(apiTokens)
                .set({ revokedAt: daysFromNow(-2) })
                .where(eq(apiTokens.id, token.id));
        }
        lines.push(
            `| ${name} | ${scope} | ${workspaces.join(', ')} | ${state} | \`${secret}\` |`
        );
    };

    await mint('Website (read)', 'read', ['main'], 'active');
    await mint('Importer (full)', 'full', ['main', 'consumer'], 'active');
    await mint('Preview — expires in 5 days', 'read', ['main'], 'expiring');
    await mint('Old build — expired', 'read', ['library'], 'expired');
    await mint('Leaked — revoked', 'full', ['main'], 'revoked');
    await mint('Archived workspace', 'read', ['archived'], 'active');

    ctx.section('API tokens', [
        ...lines,
        '',
        'Try one: `curl -H "Authorization: Bearer <secret>" -H "X-Workspace-Id: <main id>" http://localhost:3000/api/v1/content/flags_publishable`'
    ]);
}
