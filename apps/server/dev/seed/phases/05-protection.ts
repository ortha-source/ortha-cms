/**
 * Publish protection on the three `scenario_review_*` types in `main`, and an
 * entry in every review state the editor and the review queue can show.
 *
 * Order is the scenario: an entry that is already live when its rule is
 * switched on is published *before* the rule is saved, and every request,
 * vote and edit is made by the person who would make it — reviewers must be
 * members holding `content:approve`, and with `requireOtherPerson` the author
 * of the head version cannot approve it.
 */
import { eq } from 'drizzle-orm';
import {
    EntryReviewService,
    ProtectionRulesService,
    type SaveProtectionRuleDto
} from '@orthacms/protection-server';
import { reviewRequests } from '../../../../../packages/protection/server/src/lib/infrastructure/schema/review-requests';
import { ContentWriter, html } from '../content-writer';
import { daysFromNow, type SeedContext } from '../context';

const ONE = 'scenario_review_one';
const TWO = 'scenario_review_two';
const OFF = 'scenario_review_off';

export async function seedProtection(ctx: SeedContext): Promise<void> {
    const c = new ContentWriter(ctx);
    const rules = ctx.get(ProtectionRulesService);
    const reviews = ctx.get(EntryReviewService);
    const main = ctx.workspace('main').id;

    const as = (key: string) => reviews.actorFor(ctx.user(key));
    const request = async (
        entry: string,
        type: string,
        by: string,
        reviewers: string[]
    ) =>
        reviews.requestReview(
            main,
            type,
            c.id(entry),
            reviewers.map((key) => ctx.user(key).id),
            await as(by)
        );
    const approve = async (entry: string, type: string, by: string) =>
        reviews.approve(main, type, c.id(entry), await as(by));
    const draft = (key: string, type: string, title: string, by = 'editor') =>
        c.create(key, type, { title, body: html(`${title}.`) }, { as: by });

    // Live before any rule existed: protection applies to its *next* change.
    await draft(
        'review_one_live',
        ONE,
        'Live before the rule — the next edit needs review'
    );
    await c.publish('review_one_live', 'editor');
    await draft('review_off_live', OFF, 'Rule switched off — publishes freely');
    await c.publish('review_off_live', 'editor');

    const rule = (dto: SaveProtectionRuleDto) => dto;
    await rules.save(
        main,
        'collection',
        ONE,
        rule({
            enabled: true,
            requiredApprovals: 1,
            requireOtherPerson: true,
            countStaleApprovals: false,
            adminBypass: true,
            allowTokenPublish: false
        }),
        ctx.actor('admin')
    );
    await rules.save(
        main,
        'collection',
        TWO,
        rule({
            enabled: true,
            requiredApprovals: 2,
            requireOtherPerson: true,
            countStaleApprovals: false,
            adminBypass: false,
            allowTokenPublish: false
        }),
        ctx.actor('admin')
    );
    await rules.save(
        main,
        'collection',
        OFF,
        rule({
            enabled: false,
            requiredApprovals: 1,
            requireOtherPerson: true
        }),
        ctx.actor('admin')
    );

    // One approval needed.
    await draft(
        'review_not_requested',
        ONE,
        'Not requested — Request review is offered'
    );
    await draft('review_open', ONE, 'Requested — waiting for Rex or Eric');
    await request('review_open', ONE, 'editor', ['reviewer', 'editor2']);

    await draft(
        'review_published',
        ONE,
        'Approved and published — the request is resolved'
    );
    await request('review_published', ONE, 'editor', ['reviewer']);
    await approve('review_published', ONE, 'reviewer');
    await c.publish('review_published', 'editor');

    await draft(
        'review_reopened',
        ONE,
        'Approved, published, then edited — the request reopened'
    );
    await request('review_reopened', ONE, 'editor', ['reviewer']);
    await approve('review_reopened', ONE, 'reviewer');
    await c.publish('review_reopened', 'editor');
    await c.edit(
        'review_reopened',
        { body: html('Edited after it went live.') },
        'editor'
    );

    await draft(
        'review_stale_vote',
        ONE,
        'Approved, then edited — the vote is stale'
    );
    await request('review_stale_vote', ONE, 'editor', ['reviewer', 'editor2']);
    await approve('review_stale_vote', ONE, 'reviewer');
    await c.edit(
        'review_stale_vote',
        { body: html('Changed after Rex approved.') },
        'editor'
    );

    await draft('review_withdrawn', ONE, 'Requested, then withdrawn');
    await request('review_withdrawn', ONE, 'editor', ['reviewer']);
    await reviews.withdrawRequest(
        main,
        ONE,
        c.id('review_withdrawn'),
        await as('editor')
    );

    await draft(
        'review_bypassed',
        ONE,
        'Published by an admin past the rule (audited)',
        'editor2'
    );
    await c.publish('review_bypassed', 'admin', true);

    await draft('review_overdue', ONE, 'Requested five days ago — overdue');
    await request('review_overdue', ONE, 'editor', ['reviewer']);
    await ctx.db
        .update(reviewRequests)
        .set({ createdAt: daysFromNow(-5) })
        .where(eq(reviewRequests.entryId, c.id('review_overdue')));

    await c.edit(
        'review_one_live',
        { body: html('An edit to a page that was live before the rule.') },
        'editor'
    );

    // Two approvals needed, no admin bypass.
    await draft('review_two_partial', TWO, 'One of two approvals');
    await request('review_two_partial', TWO, 'editor', [
        'reviewer',
        'editor2',
        'admin2'
    ]);
    await approve('review_two_partial', TWO, 'reviewer');

    await draft('review_two_ready', TWO, 'Two of two — ready to publish');
    await request('review_two_ready', TWO, 'editor', ['reviewer', 'editor2']);
    await approve('review_two_ready', TWO, 'reviewer');
    await approve('review_two_ready', TWO, 'editor2');

    await draft(
        'review_off_draft',
        OFF,
        'Rule switched off — a draft',
        'editor2'
    );

    ctx.section('Protection (Main)', [
        '- `scenario_review_one` — 1 approval, someone other than the author, admin bypass allowed',
        '- `scenario_review_two` — 2 approvals, no admin bypass',
        '- `scenario_review_off` — a rule that is switched off',
        '',
        'Entries cover: not requested, open, approved and published, reopened by an edit, a stale vote, withdrawn, an admin bypass, overdue, 1 of 2, 2 of 2.',
        'Sign in as `reviewer@dev.local` for the review queue; `editor@dev.local` authored most of them.'
    ]);
}
