/**
 * Alarm rules in `main`, with findings in each state.
 *
 * Findings are derived, never inserted: a rule rescans when it is created, so
 * the entries it should catch already exist (from the content phase), and a
 * finding resolves when an edit makes its entry stop matching. The one state
 * no service produces — a rule whose stored filter no longer parses — is
 * written directly.
 */
import { eq } from 'drizzle-orm';
import { AlarmRulesService, alarmRules } from '@orthacms/alarms-server';
import { ContentWriter } from '../content-writer';
import type { SeedContext } from '../context';

type Severity = 'error' | 'warn' | 'info';
const isEmpty = (field: string) => ({
    and: [{ field, op: 'null', value: true }]
});

export async function seedAlarms(ctx: SeedContext): Promise<void> {
    const alarms = ctx.get(AlarmRulesService);
    const c = new ContentWriter(ctx);
    const main = ctx.workspace('main').id;
    const admin = ctx.user('admin');

    const rule = async (
        contentType: string,
        name: string,
        findingTitle: string,
        severity: Severity,
        filter: Record<string, unknown>,
        enabled = true,
        workspaceId = main
    ) => {
        const { rule } = await alarms.create(
            workspaceId,
            admin.id,
            {
                contentType,
                name,
                findingTitle,
                severity,
                filter,
                enabled,
                description: `Seeded: ${name.toLowerCase()}.`
            },
            ctx.actor('admin')
        );
        return rule.id;
    };

    await rule(
        'field_date',
        'Records without a datetime',
        'No datetime',
        'error',
        isEmpty('datetime')
    );
    await rule(
        'field_text',
        'Records without an email',
        'No email',
        'warn',
        isEmpty('email')
    );
    await rule(
        'flags_publishable',
        'Unpublished drafts',
        'Still a draft',
        'info',
        { and: [{ field: 'status', op: 'eq', value: 'draft' }] }
    );
    await rule('field_number', 'Rating of zero', 'Rated zero', 'warn', {
        and: [{ field: 'rating', op: 'eq', value: 0 }]
    });
    await rule(
        'flags_paranoid',
        'Switched off',
        'Never raised',
        'info',
        isEmpty('title'),
        false
    );

    // A finding that opens, then resolves when the entry is fixed.
    await rule(
        'field_select',
        'Optional select left empty',
        'No optional select',
        'info',
        isEmpty('select')
    );
    await c.edit('select_minimal', { select: 'alpha' }, 'editor');

    const broken = await rule(
        'field_number',
        'Broken — its filter no longer parses',
        'Never raised',
        'error',
        isEmpty('rating')
    );
    await ctx.db
        .update(alarmRules)
        .set({
            brokenReason:
                'The field "rating" no longer exists on field_number (seeded: a schema change broke this rule).'
        })
        .where(eq(alarmRules.id, broken));

    // One in Library too, so the admin's inbox spans two workspaces — the
    // reason the inbox exists. It flags `lib_draft`.
    await rule(
        'rel_target',
        'Unpublished shared targets',
        'Not shared yet — still a draft',
        'warn',
        { and: [{ field: 'status', op: 'eq', value: 'draft' }] },
        true,
        ctx.workspace('library').id
    );

    ctx.section('Alarms (Main)', [
        '- error: `field_date` without a datetime; warn: `field_text` without an email; info: `flags_publishable` drafts',
        '- a rule with no matches (`field_number` rating 0), a disabled rule, a broken rule',
        '- `field_select`: a finding that opened and then resolved when the record was fixed',
        '- Library: a warn rule over `rel_target` drafts, flagging `lib_draft`'
    ]);
}
