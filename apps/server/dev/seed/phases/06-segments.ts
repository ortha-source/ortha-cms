/**
 * Reader segments and per-entry access rules.
 *
 * A segment is not a group of users: a reader's tags arrive with the request
 * (`X-Reader-Tags` on the public API), and a segment matches when its tags
 * intersect them. So what is seeded is the catalogue and which entries allow
 * or deny which segments — try them with
 * `curl -H 'X-Reader-Tags: premium' …/api/v1/content/flags_publishable`.
 */
import { EntryAccessService } from '@orthacms/segments-server';
import { SegmentsService } from '../../../../../packages/segments/server/src/lib/application/segments.service';
import { ContentWriter, html } from '../content-writer';
import type { SeedContext } from '../context';

const TYPE = 'flags_publishable';

export async function seedSegments(ctx: SeedContext): Promise<void> {
    const service = ctx.get(SegmentsService);
    const access = ctx.get(EntryAccessService);
    const c = new ContentWriter(ctx);
    const actor = ctx.actor('admin');
    const main = ctx.workspace('main').id;

    const premium = await service.create({
        key: 'premium',
        label: 'Premium readers',
        tags: ['premium', 'paid'],
        actor
    });
    const eu = await service.create({
        key: 'eu',
        label: 'Readers in the EU',
        tags: ['eu'],
        actor
    });
    const beta = await service.create({
        key: 'beta',
        label: 'Beta testers (Main only)',
        tags: ['beta'],
        workspaceIds: [main],
        actor
    });
    await service.create({
        key: 'unused',
        label: 'Defined, used by no entry',
        tags: ['unused'],
        actor
    });

    const restrict = async (
        key: string,
        title: string,
        allow: string[],
        deny: string[]
    ) => {
        await c.create(key, TYPE, { title, body: html(`${title}.`) });
        await c.publish(key);
        await access.setForGroup({
            workspaceId: main,
            type: ctx.type(TYPE),
            entryId: c.id(key),
            allow,
            deny,
            actor
        });
    };
    await restrict(
        'segment_premium',
        'Segments — premium readers only',
        [premium.id],
        []
    );
    await restrict(
        'segment_not_eu',
        'Segments — everyone except the EU',
        [],
        [eu.id]
    );
    await restrict(
        'segment_premium_not_beta',
        'Segments — premium, but not beta testers',
        [premium.id],
        [beta.id]
    );
    await c.create('segment_open', TYPE, {
        title: 'Segments — no rule: everyone',
        body: html('Unrestricted.')
    });
    await c.publish('segment_open');

    ctx.section('Segments', [
        'Segments `premium` (tags premium, paid), `eu`, `beta` (Main only) and `unused`.',
        'Entries in `flags_publishable` titled "Segments — …" allow or deny them. Reader tags come from the `X-Reader-Tags` header.'
    ]);
}
