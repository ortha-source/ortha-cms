import request from 'supertest';
import { getPool } from '@orthacms/database';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import { TEST_ALLOWED_ORIGIN } from '../../support/test-config';
import {
    resetDb,
    seedActiveUser,
    seedContentGrants,
    seedMembership,
    seedWorkspace,
    type SeededUser,
    type SeededWorkspace
} from '../../support/seed';

const PASSWORD = 'SecurePass123!';
const AUTHOR = 'review-author@example.com';
const REVIEWER = 'review-reviewer@example.com';
const SECOND_REVIEWER = 'review-second@example.com';
const ADMIN = 'review-admin@example.com';
/**
 * A second administrator, used only to write the rule under test.
 *
 * Separate from `ADMIN` so a test that needs an administrator of its own — to
 * withdraw somebody else's request, or to be refused a self-approval — is not
 * seeding the same email twice.
 */
const RULE_ADMIN = 'review-rule-admin@example.com';
const VIEWER = 'review-viewer@example.com';

/**
 * `/api/protection/entries/:type/:id` — the review surface.
 *
 * Almost every assertion here is a sentence from the design document that
 * nothing else enforces: that an approval is bound to a **revision** so a save
 * invalidates it without any dismissal logic, that the author of the head
 * cannot approve it, that requesting changes is zero votes plus an explanation
 * rather than a veto, and that asking for review twice updates one row instead
 * of stacking a second into somebody's queue.
 *
 * The counting itself is `evaluateProtection` in `@orthacms/protection-domain`
 * and is unit-tested there. What is tested here is that the server hands it the
 * right head revision and the right votes — the half a pure function cannot
 * check.
 */
describe('/api/protection/entries', () => {
    let harness: TestApp;
    let workspace: SeededWorkspace;

    beforeAll(async () => {
        harness = await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        workspace = await seedWorkspace({ name: 'Press', slug: 'press' });
        await seedContentGrants(workspace.id, ['test_article']);
    });

    /** Seed a member of `role`, log them in, and scope the agent to the workspace. */
    async function member(
        email: string,
        role: 'admin' | 'contributor' | 'viewer'
    ): Promise<{ user: SeededUser; agent: ReturnType<typeof request.agent> }> {
        const user = await seedActiveUser(harness.app, {
            email,
            password: PASSWORD,
            role
        });
        await seedMembership(user.id, workspace.id);
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspace.id);
        return { user, agent };
    }

    /** Write the rule for `test_article`, as an administrator. */
    async function protect(fields: Record<string, unknown>): Promise<void> {
        const { agent } = await member(RULE_ADMIN, 'admin');
        await agent
            .put('/api/protection/rules/collection/test_article')
            .send(fields)
            .expect(200);
    }

    /** Create an entry through the real content API and return its id. */
    async function createEntry(
        agent: ReturnType<typeof request.agent>,
        text = 'First draft'
    ): Promise<string> {
        const created = await agent
            .post('/api/content/test_article')
            .send({ values: { text, select: 'article' } })
            .expect(201);
        return created.body.id as string;
    }

    /** Save the entry again, which appends a new revision and moves the head. */
    async function editEntry(
        agent: ReturnType<typeof request.agent>,
        id: string,
        text: string
    ): Promise<void> {
        await agent
            .patch(`/api/content/test_article/${id}`)
            .send({ values: { text } })
            .expect(200);
    }

    /** The entry's revisions, oldest first. */
    async function revisionsOf(
        entryId: string
    ): Promise<{ id: string; number: number }[]> {
        const { rows } = await getPool().query<{ id: string; number: number }>(
            `SELECT id, revision_number AS number
             FROM content_entry_revisions
             WHERE entry_id = $1 ORDER BY revision_number`,
            [entryId]
        );
        return rows;
    }

    /** Open review requests for one entry. */
    async function openRequests(entryId: string): Promise<number> {
        const { rows } = await getPool().query<{ count: string }>(
            `SELECT count(*)::text AS count FROM review_requests
             WHERE entry_id = $1 AND resolved_at IS NULL`,
            [entryId]
        );
        return Number(rows[0].count);
    }

    /** Every review request row for one entry, open or not. */
    async function allRequests(entryId: string): Promise<number> {
        const { rows } = await getPool().query<{ count: string }>(
            `SELECT count(*)::text AS count FROM review_requests WHERE entry_id = $1`,
            [entryId]
        );
        return Number(rows[0].count);
    }

    /** Approval rows for one entry. */
    async function approvalRows(
        entryId: string
    ): Promise<{ userId: string; revisionId: string; decision: string }[]> {
        const { rows } = await getPool().query(
            `SELECT user_id AS "userId", revision_id AS "revisionId", decision
             FROM review_approvals WHERE entry_id = $1 ORDER BY created_at`,
            [entryId]
        );
        return rows;
    }

    /**
     * Audit rows for one subject, polled — the outbox dispatcher drains on
     * commit, but the drain is a separate transaction and asserting on it
     * immediately makes the test a race rather than a check.
     */
    async function auditFor(
        subjectId: string,
        kinds: readonly string[],
        expected = 1
    ): Promise<{ kind: string; actorId: string | null; meta: unknown }[]> {
        for (let attempt = 0; attempt < 40; attempt += 1) {
            const { rows } = await getPool().query(
                `SELECT kind, actor_id AS "actorId", meta
                 FROM activity_events
                 WHERE subject_id = $1 AND kind = ANY($2::text[])
                 ORDER BY at, id`,
                [subjectId, [...kinds]]
            );
            if (rows.length >= expected) return rows;
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
        return [];
    }

    describe('GET /entries/:type/:id', () => {
        it('reports an unprotected type as needing nothing', async () => {
            const { agent } = await member(AUTHOR, 'contributor');
            const id = await createEntry(agent);

            const response = await agent
                .get(`/api/protection/entries/test_article/${id}`)
                .expect(200);

            expect(response.body).toMatchObject({
                protected: false,
                required: 0,
                given: 0,
                stale: 0,
                blocked: false,
                approvals: [],
                request: null
            });
        });

        /**
         * The read is `content:read`, deliberately — `protection:manage` is
         * administrator-only, and a contributor still has to see "0 of 2" on
         * the entry they are editing.
         */
        it('is readable by a contributor, who cannot read the rule table', async () => {
            await protect({ enabled: true, requiredApprovals: 2 });
            const { agent } = await member(AUTHOR, 'contributor');
            const id = await createEntry(agent);

            await agent
                .get(`/api/protection/entries/test_article/${id}`)
                .expect(200)
                .expect((res) => {
                    expect(res.body).toMatchObject({
                        protected: true,
                        required: 2,
                        given: 0,
                        blocked: true
                    });
                });

            // The same person cannot read the workspace's rules.
            await agent.get('/api/protection/rules').expect(403);
        });

        it('is refused without a session', async () => {
            const { agent } = await member(AUTHOR, 'contributor');
            const id = await createEntry(agent);

            await request(harness.server)
                .get(`/api/protection/entries/test_article/${id}`)
                .set('X-Workspace-Id', workspace.id)
                .expect(401);
        });

        it('404s for an entry in another workspace', async () => {
            const { agent } = await member(AUTHOR, 'contributor');
            const id = await createEntry(agent);

            const other = await seedWorkspace({ name: 'Other', slug: 'other' });
            await seedContentGrants(other.id, ['test_article']);
            await seedMembership(
                (
                    await seedActiveUser(harness.app, {
                        email: 'elsewhere@example.com',
                        password: PASSWORD,
                        role: 'admin'
                    })
                ).id,
                other.id
            );

            const outsider = request.agent(harness.server);
            await outsider
                .post('/api/auth/login')
                .send({ email: 'elsewhere@example.com', password: PASSWORD })
                .expect(201);

            await outsider
                .get(`/api/protection/entries/test_article/${id}`)
                .set('X-Workspace-Id', other.id)
                .expect(404);
        });

        it('404s for a content type the workspace was not granted', async () => {
            const { agent } = await member(AUTHOR, 'contributor');
            const id = await createEntry(agent);

            // `test_author` exists but this workspace holds no grant for it —
            // the same answer a type that does not exist gets.
            await agent
                .get(`/api/protection/entries/test_author/${id}`)
                .expect(404);
            await agent
                .get(`/api/protection/entries/no_such_type/${id}`)
                .expect(404);
        });
    });

    describe('POST /entries/:type/:id/request', () => {
        it('opens a request and records who asked', async () => {
            await protect({ enabled: true, requiredApprovals: 1 });
            const { agent, user } = await member(AUTHOR, 'contributor');
            const id = await createEntry(agent);

            await agent
                .post(`/api/protection/entries/test_article/${id}/request`)
                .send({ note: 'Please check the revenue table' })
                .expect(201);

            const state = await agent
                .get(`/api/protection/entries/test_article/${id}`)
                .expect(200);
            expect(state.body.request).toMatchObject({
                requestedBy: user.id,
                note: 'Please check the revenue table'
            });
            expect(await openRequests(id)).toBe(1);
        });

        /**
         * The partial unique index means a second ask is an update. A 409 here
         * would make "send it again, I added something" a thing the product
         * refuses for no reason a person would recognise.
         */
        it('updates the open request rather than stacking a second', async () => {
            await protect({ enabled: true });
            const { agent } = await member(AUTHOR, 'contributor');
            const id = await createEntry(agent);

            await agent
                .post(`/api/protection/entries/test_article/${id}/request`)
                .send({ note: 'first' })
                .expect(201);
            await agent
                .post(`/api/protection/entries/test_article/${id}/request`)
                .send({ note: 'second' })
                .expect(201);

            expect(await openRequests(id)).toBe(1);
            const state = await agent
                .get(`/api/protection/entries/test_article/${id}`)
                .expect(200);
            expect(state.body.request.note).toBe('second');
        });

        it('survives a save — the request outlives the revision it was opened on', async () => {
            await protect({ enabled: true });
            const { agent } = await member(AUTHOR, 'contributor');
            const id = await createEntry(agent);
            await agent
                .post(`/api/protection/entries/test_article/${id}/request`)
                .send({})
                .expect(201);

            await editEntry(agent, id, 'A typo fixed after asking');

            // An author who fixes a typo after asking has not withdrawn the
            // request; re-opening one on every save would churn the queue.
            expect(await openRequests(id)).toBe(1);
        });

        it('is refused to a viewer, who cannot update content', async () => {
            await protect({ enabled: true });
            const { agent: authorAgent } = await member(AUTHOR, 'contributor');
            const id = await createEntry(authorAgent);

            const { agent } = await member(VIEWER, 'viewer');
            await agent
                .post(`/api/protection/entries/test_article/${id}/request`)
                .send({})
                .expect(403);
        });

        it('is refused from a disallowed origin', async () => {
            await protect({ enabled: true });
            const { agent } = await member(AUTHOR, 'contributor');
            const id = await createEntry(agent);

            await agent
                .post(`/api/protection/entries/test_article/${id}/request`)
                .set('Origin', 'https://evil.example')
                .send({})
                .expect(403);

            await agent
                .post(`/api/protection/entries/test_article/${id}/request`)
                .set('Origin', TEST_ALLOWED_ORIGIN)
                .send({})
                .expect(201);
        });

        it('rejects an unknown field', async () => {
            await protect({ enabled: true });
            const { agent } = await member(AUTHOR, 'contributor');
            const id = await createEntry(agent);

            await agent
                .post(`/api/protection/entries/test_article/${id}/request`)
                .send({ note: 'ok', urgency: 'high' })
                .expect(400);
        });

        it('writes a review.requested audit row against the entry', async () => {
            await protect({ enabled: true });
            const { agent, user } = await member(AUTHOR, 'contributor');
            const id = await createEntry(agent);

            await agent
                .post(`/api/protection/entries/test_article/${id}/request`)
                .send({ note: 'have a look' })
                .expect(201);

            const rows = await auditFor(id, ['review.requested']);
            expect(rows).toHaveLength(1);
            expect(rows[0].actorId).toBe(user.id);
            expect(rows[0].meta).toMatchObject({
                contentType: 'test_article'
            });
        });
    });

    describe('DELETE /entries/:type/:id/request', () => {
        it('lets the requester withdraw, resolving the row rather than deleting it', async () => {
            await protect({ enabled: true });
            const { agent } = await member(AUTHOR, 'contributor');
            const id = await createEntry(agent);
            await agent
                .post(`/api/protection/entries/test_article/${id}/request`)
                .send({})
                .expect(201);

            await agent
                .delete(`/api/protection/entries/test_article/${id}/request`)
                .expect(204);

            expect(await openRequests(id)).toBe(0);
            // Resolved, not gone: the trail keeps that it was asked for.
            expect(await allRequests(id)).toBe(1);
        });

        it('lets an administrator withdraw somebody else’s request', async () => {
            await protect({ enabled: true });
            const { agent: author } = await member(AUTHOR, 'contributor');
            const id = await createEntry(author);
            await author
                .post(`/api/protection/entries/test_article/${id}/request`)
                .send({})
                .expect(201);

            const { agent: admin } = await member(ADMIN, 'admin');
            await admin
                .delete(`/api/protection/entries/test_article/${id}/request`)
                .expect(204);
            expect(await openRequests(id)).toBe(0);
        });

        it('refuses a different contributor', async () => {
            await protect({ enabled: true });
            const { agent: author } = await member(AUTHOR, 'contributor');
            const id = await createEntry(author);
            await author
                .post(`/api/protection/entries/test_article/${id}/request`)
                .send({})
                .expect(201);

            const { agent: other } = await member(REVIEWER, 'contributor');
            await other
                .delete(`/api/protection/entries/test_article/${id}/request`)
                .expect(403);
            expect(await openRequests(id)).toBe(1);
        });

        it('404s when there is nothing open to withdraw', async () => {
            await protect({ enabled: true });
            const { agent } = await member(AUTHOR, 'contributor');
            const id = await createEntry(agent);

            await agent
                .delete(`/api/protection/entries/test_article/${id}/request`)
                .expect(404);
        });
    });

    describe('POST /entries/:type/:id/approve', () => {
        it('records a vote and satisfies the rule', async () => {
            await protect({ enabled: true, requiredApprovals: 1 });
            const { agent: author } = await member(AUTHOR, 'contributor');
            const id = await createEntry(author);

            const { agent: reviewer, user } = await member(
                REVIEWER,
                'contributor'
            );
            await reviewer
                .post(`/api/protection/entries/test_article/${id}/approve`)
                .send({ note: 'reads fine' })
                .expect(201);

            const state = await author
                .get(`/api/protection/entries/test_article/${id}`)
                .expect(200);
            expect(state.body).toMatchObject({
                required: 1,
                given: 1,
                stale: 0,
                blocked: false
            });
            expect(state.body.approvals).toHaveLength(1);
            expect(state.body.approvals[0]).toMatchObject({
                userId: user.id,
                decision: 'approved',
                isStale: false,
                note: 'reads fine'
            });
        });

        /**
         * ⭐ The feature's whole point, end to end. The approval is not deleted
         * and no dismissal code runs — the head simply moved, and the vote that
         * counted is now attached to a version nobody is publishing.
         */
        it('stops counting after a save, and says which version it was given on', async () => {
            await protect({ enabled: true, requiredApprovals: 1 });
            const { agent: author } = await member(AUTHOR, 'contributor');
            const id = await createEntry(author);

            const { agent: reviewer } = await member(REVIEWER, 'contributor');
            await reviewer
                .post(`/api/protection/entries/test_article/${id}/approve`)
                .send({})
                .expect(201);

            const before = await author
                .get(`/api/protection/entries/test_article/${id}`)
                .expect(200);
            expect(before.body).toMatchObject({ given: 1, blocked: false });

            await editEntry(author, id, 'Second draft');

            const after = await author
                .get(`/api/protection/entries/test_article/${id}`)
                .expect(200);
            expect(after.body).toMatchObject({
                given: 0,
                stale: 1,
                blocked: true
            });
            // Nothing was deleted — the row survives so the panel can strike it
            // through and name its version.
            expect(await approvalRows(id)).toHaveLength(1);
            expect(after.body.approvals[0]).toMatchObject({
                isStale: true,
                revisionNumber: 1
            });
        });

        it('counts the stale vote again when the rule says to', async () => {
            await protect({
                enabled: true,
                requiredApprovals: 1,
                countStaleApprovals: true
            });
            const { agent: author } = await member(AUTHOR, 'contributor');
            const id = await createEntry(author);
            const { agent: reviewer } = await member(REVIEWER, 'contributor');
            await reviewer
                .post(`/api/protection/entries/test_article/${id}/approve`)
                .send({})
                .expect(201);

            await editEntry(author, id, 'Second draft');

            const after = await author
                .get(`/api/protection/entries/test_article/${id}`)
                .expect(200);
            expect(after.body).toMatchObject({
                given: 1,
                stale: 0,
                blocked: false
            });
        });

        /** ⭐ Four eyes: the author of the head cannot be one of them. */
        it('409s when the caller wrote the head revision', async () => {
            await protect({
                enabled: true,
                requiredApprovals: 1,
                requireOtherPerson: true
            });
            const { agent: author } = await member(AUTHOR, 'contributor');
            const id = await createEntry(author);

            const response = await author
                .post(`/api/protection/entries/test_article/${id}/approve`)
                .send({})
                .expect(409);
            expect(response.body.code).toBe('protection.self_approval_refused');
            expect(await approvalRows(id)).toHaveLength(0);
        });

        it('409s for an administrator who wrote the head, too', async () => {
            await protect({ enabled: true, requireOtherPerson: true });
            const { agent } = await member(ADMIN, 'admin');
            const id = await createEntry(agent);

            await agent
                .post(`/api/protection/entries/test_article/${id}/approve`)
                .send({})
                .expect(409);
        });

        it('lets the author approve once the switch is off', async () => {
            await protect({
                enabled: true,
                requiredApprovals: 1,
                requireOtherPerson: false
            });
            const { agent } = await member(AUTHOR, 'contributor');
            const id = await createEntry(agent);

            await agent
                .post(`/api/protection/entries/test_article/${id}/approve`)
                .send({})
                .expect(201);
        });

        /**
         * The author of the *head*, not of the entry. Somebody else saving
         * means the original author is no longer the person being checked.
         */
        it('lets the original author approve after somebody else saved', async () => {
            await protect({
                enabled: true,
                requiredApprovals: 1,
                requireOtherPerson: true
            });
            const { agent: author } = await member(AUTHOR, 'contributor');
            const id = await createEntry(author);

            const { agent: editor } = await member(REVIEWER, 'contributor');
            await editEntry(editor, id, 'Edited by somebody else');

            await author
                .post(`/api/protection/entries/test_article/${id}/approve`)
                .send({})
                .expect(201);
        });

        it('changes a vote rather than adding a second row', async () => {
            await protect({ enabled: true, requiredApprovals: 1 });
            const { agent: author } = await member(AUTHOR, 'contributor');
            const id = await createEntry(author);
            const { agent: reviewer } = await member(REVIEWER, 'contributor');

            await reviewer
                .post(`/api/protection/entries/test_article/${id}/changes`)
                .send({ note: 'numbers are off' })
                .expect(201);
            await reviewer
                .post(`/api/protection/entries/test_article/${id}/approve`)
                .send({ note: 'fixed' })
                .expect(201);

            const rows = await approvalRows(id);
            expect(rows).toHaveLength(1);
            expect(rows[0].decision).toBe('approved');
        });

        it('needs content:approve, which a viewer does not hold', async () => {
            await protect({ enabled: true });
            const { agent: author } = await member(AUTHOR, 'contributor');
            const id = await createEntry(author);

            const { agent } = await member(VIEWER, 'viewer');
            await agent
                .post(`/api/protection/entries/test_article/${id}/approve`)
                .send({})
                .expect(403);
        });

        it('writes a review.approved audit row naming the version', async () => {
            await protect({ enabled: true });
            const { agent: author } = await member(AUTHOR, 'contributor');
            const id = await createEntry(author);
            const { agent: reviewer, user } = await member(
                REVIEWER,
                'contributor'
            );

            await reviewer
                .post(`/api/protection/entries/test_article/${id}/approve`)
                .send({})
                .expect(201);

            const rows = await auditFor(id, ['review.approved']);
            expect(rows).toHaveLength(1);
            expect(rows[0].actorId).toBe(user.id);
            // The revision number is what makes the trail survive later edits:
            // "approved" with nothing to say what was approved is not a trail.
            expect(rows[0].meta).toMatchObject({
                contentType: 'test_article',
                revisionNumber: 1
            });
        });
    });

    describe('POST /entries/:type/:id/changes', () => {
        /**
         * ⭐ Requesting changes is zero votes plus an explanation, never a
         * veto. A reviewer who wants to block simply does not approve — which
         * is what stops one person on holiday holding a workspace hostage.
         */
        it('does not lower a count the approvals already gave', async () => {
            await protect({ enabled: true, requiredApprovals: 1 });
            const { agent: author } = await member(AUTHOR, 'contributor');
            const id = await createEntry(author);

            const { agent: approver } = await member(REVIEWER, 'contributor');
            await approver
                .post(`/api/protection/entries/test_article/${id}/approve`)
                .send({})
                .expect(201);

            const { agent: objector } = await member(
                SECOND_REVIEWER,
                'contributor'
            );
            await objector
                .post(`/api/protection/entries/test_article/${id}/changes`)
                .send({ note: 'I disagree' })
                .expect(201);

            const state = await author
                .get(`/api/protection/entries/test_article/${id}`)
                .expect(200);
            expect(state.body).toMatchObject({
                given: 1,
                blocked: false,
                changesRequested: 1
            });
        });

        it('writes a review.changes_requested audit row with the note', async () => {
            await protect({ enabled: true });
            const { agent: author } = await member(AUTHOR, 'contributor');
            const id = await createEntry(author);
            const { agent: reviewer } = await member(REVIEWER, 'contributor');

            await reviewer
                .post(`/api/protection/entries/test_article/${id}/changes`)
                .send({ note: 'March does not add up' })
                .expect(201);

            const rows = await auditFor(id, ['review.changes_requested']);
            expect(rows).toHaveLength(1);
            expect(rows[0].meta).toMatchObject({
                note: 'March does not add up'
            });
        });
    });

    describe('DELETE /entries/:type/:id/approve', () => {
        it('withdraws the caller’s own vote', async () => {
            await protect({ enabled: true, requiredApprovals: 1 });
            const { agent: author } = await member(AUTHOR, 'contributor');
            const id = await createEntry(author);
            const { agent: reviewer } = await member(REVIEWER, 'contributor');
            await reviewer
                .post(`/api/protection/entries/test_article/${id}/approve`)
                .send({})
                .expect(201);

            await reviewer
                .delete(`/api/protection/entries/test_article/${id}/approve`)
                .expect(204);

            expect(await approvalRows(id)).toHaveLength(0);
            const state = await author
                .get(`/api/protection/entries/test_article/${id}`)
                .expect(200);
            expect(state.body).toMatchObject({ given: 0, blocked: true });
        });

        it('leaves another reviewer’s vote alone', async () => {
            await protect({ enabled: true, requiredApprovals: 2 });
            const { agent: author } = await member(AUTHOR, 'contributor');
            const id = await createEntry(author);
            const { agent: first } = await member(REVIEWER, 'contributor');
            const { agent: second, user: secondUser } = await member(
                SECOND_REVIEWER,
                'contributor'
            );
            await first
                .post(`/api/protection/entries/test_article/${id}/approve`)
                .send({})
                .expect(201);
            await second
                .post(`/api/protection/entries/test_article/${id}/approve`)
                .send({})
                .expect(201);

            await first
                .delete(`/api/protection/entries/test_article/${id}/approve`)
                .expect(204);

            const rows = await approvalRows(id);
            expect(rows).toHaveLength(1);
            expect(rows[0].userId).toBe(secondUser.id);
        });

        it('is idempotent when there is no vote to withdraw', async () => {
            await protect({ enabled: true });
            const { agent: author } = await member(AUTHOR, 'contributor');
            const id = await createEntry(author);
            const { agent: reviewer } = await member(REVIEWER, 'contributor');

            await reviewer
                .delete(`/api/protection/entries/test_article/${id}/approve`)
                .expect(204);
        });

        /**
         * A withdrawal only reaches the head. A vote on an older revision is
         * already not counting, and deleting it would erase the struck-through
         * line that explains why the number moved.
         */
        it('does not reach back to a stale vote', async () => {
            await protect({ enabled: true });
            const { agent: author } = await member(AUTHOR, 'contributor');
            const id = await createEntry(author);
            const { agent: reviewer } = await member(REVIEWER, 'contributor');
            await reviewer
                .post(`/api/protection/entries/test_article/${id}/approve`)
                .send({})
                .expect(201);

            await editEntry(author, id, 'Second draft');
            expect((await revisionsOf(id)).length).toBeGreaterThan(1);

            await reviewer
                .delete(`/api/protection/entries/test_article/${id}/approve`)
                .expect(204);

            expect(await approvalRows(id)).toHaveLength(1);
        });
    });

    describe('an unprotected type still records review', () => {
        /**
         * Asking for a second pair of eyes on a type nobody protected is a
         * reasonable thing to do, and refusing it would make the queue a
         * function of the settings tab rather than of what people asked for.
         * What an unprotected type does not do is *block*.
         */
        it('accepts a request and an approval, and blocks nothing', async () => {
            const { agent: author } = await member(AUTHOR, 'contributor');
            const id = await createEntry(author);
            await author
                .post(`/api/protection/entries/test_article/${id}/request`)
                .send({})
                .expect(201);

            const { agent: reviewer } = await member(REVIEWER, 'contributor');
            await reviewer
                .post(`/api/protection/entries/test_article/${id}/approve`)
                .send({})
                .expect(201);

            const state = await author
                .get(`/api/protection/entries/test_article/${id}`)
                .expect(200);
            expect(state.body).toMatchObject({
                protected: false,
                required: 0,
                blocked: false
            });
            expect(state.body.approvals).toHaveLength(1);
        });
    });
});
