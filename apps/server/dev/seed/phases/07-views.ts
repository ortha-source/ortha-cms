/**
 * Saved views on the records table: private and workspace-wide, one set as a
 * default, and filters on plugin-provided virtual fields (`reviewState` from
 * protection, `missingLocale` from i18n). `filter` and `sort` are stored as the
 * raw `?filter=` / `?sort=` strings the table sends.
 */
import { CreateSavedViewUseCase } from '../../../../../packages/content/server/src/lib/views/application/use-cases/create-saved-view.use-case';
import type { SeedContext } from '../context';

const filter = (...rules: { field: string; op: string; value: unknown }[]) =>
    JSON.stringify({ and: rules });

export async function seedViews(ctx: SeedContext): Promise<void> {
    const views = ctx.get(CreateSavedViewUseCase);
    const workspaceId = ctx.workspace('main').id;

    await views.execute(
        {
            workspaceId,
            scope: 'content:flags_publishable',
            name: 'Drafts',
            visibility: 'private',
            payload: {
                filter: filter({ field: 'status', op: 'eq', value: 'draft' }),
                sort: '-updatedAt'
            }
        },
        ctx.user('admin')
    );
    await views.execute(
        {
            workspaceId,
            scope: 'content:flags_publishable',
            name: 'Recently changed (default)',
            visibility: 'private',
            payload: { sort: '-updatedAt', pageSize: 10 },
            makeDefault: true
        },
        ctx.user('admin')
    );
    await views.execute(
        {
            workspaceId,
            scope: 'content:scenario_review_one',
            name: 'Needs review',
            visibility: 'workspace',
            payload: {
                filter: filter({
                    field: 'reviewState',
                    op: 'eq',
                    value: 'awaiting'
                })
            }
        },
        ctx.user('editor')
    );
    await views.execute(
        {
            workspaceId,
            scope: 'content:i18n_fields',
            name: 'Missing German',
            visibility: 'workspace',
            payload: {
                filter: filter({
                    field: 'missingLocale',
                    op: 'eq',
                    value: 'de'
                })
            }
        },
        ctx.user('admin')
    );
    await views.execute(
        {
            workspaceId,
            scope: 'content:field_text',
            name: 'Only some columns',
            visibility: 'private',
            payload: { columns: ['required', 'bounded', 'email'] }
        },
        ctx.user('editor')
    );

    ctx.section('Saved views (Main)', [
        '- `flags_publishable`: "Drafts" and "Recently changed" (Ada\'s default) — private to Ada',
        '- `scenario_review_one`: "Needs review" (reviewState = awaiting) — shared with the workspace by Edith',
        '- `i18n_fields`: "Missing German" (missingLocale = de) — shared with the workspace',
        '- `field_text`: "Only some columns" — private to Edith'
    ]);
}
