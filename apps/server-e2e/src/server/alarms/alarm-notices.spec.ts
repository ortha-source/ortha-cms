import request from 'supertest';
import { getPool } from '@orthacms/database';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import { drainMail, resetMail } from '../../support/mail';
import { runAlarmDigest } from '../../support/alarm-digest';
import {
    resetDb,
    seedActiveUser,
    seedAllContentGrants,
    seedMembership,
    seedWorkspace
} from '../../support/seed';

const ADMIN = 'alarm-notices-admin@example.com';
const OTHER = 'alarm-notices-other@example.com';
const PASSWORD = 'SecurePass123!';

/** Matches the fixture records below, and nothing else. */
const FLAG_ME = {
    and: [{ field: 'text', op: 'ilike', value: '%flag me%' }]
};

/** 09:00 UTC on a Wednesday — after the default digest hour, not a Monday. */
const WEDNESDAY_MORNING = new Date('2026-10-28T09:00:00.000Z');

async function digestRows(): Promise<{ toAddress: string; subject: string }[]> {
    const { rows } = await getPool().query(
        `SELECT to_address AS "toAddress", subject FROM mail_deliveries
         WHERE kind = 'alarm_digest' ORDER BY created_at`
    );
    return rows;
}

/**
 * What an alarm tells people (ADR-0023): its creator's inbox when a scan opens
 * findings, and a digest by mail — once a period, only when something is new,
 * never for `info`, never to anybody but the person who made the alarm.
 */
describe('alarm notices', () => {
    let harness: TestApp;
    let workspaceId: string;

    beforeAll(async () => {
        harness = await createTestApp({ mail: {} });
    });

    afterAll(async () => {
        await closeTestApp(harness);
    });

    beforeEach(async () => {
        await resetDb();
        resetMail();
        const workspace = await seedWorkspace({ name: 'Press', slug: 'press' });
        workspaceId = workspace.id;
        await seedAllContentGrants(workspaceId);
        for (const [email, role] of [
            [ADMIN, 'admin'],
            [OTHER, 'contributor']
        ] as const) {
            const user = await seedActiveUser(harness.app, {
                email,
                password: PASSWORD,
                role
            });
            await seedMembership(user.id, workspaceId);
        }
    });

    async function login(email: string) {
        const agent = request.agent(harness.server);
        await agent
            .post('/api/auth/login')
            .send({ email, password: PASSWORD })
            .expect(201);
        agent.set('X-Workspace-Id', workspaceId);
        return agent;
    }

    async function seedFlagged(count: number) {
        const admin = await login(ADMIN);
        for (let i = 0; i < count; i += 1) {
            await admin
                .post('/api/content/test_article')
                .send({
                    values: { text: `Please flag me ${i}`, select: 'article' }
                })
                .expect(201);
        }
        return admin;
    }

    async function createAlarm(
        admin: Awaited<ReturnType<typeof login>>,
        severity: 'error' | 'warn' | 'info'
    ) {
        await admin
            .post('/api/alarms/rules')
            .send({
                contentType: 'test_article',
                name: `Flagged ${severity}`,
                findingTitle: 'Says flag me',
                severity,
                filter: FLAG_ME
            })
            .expect(201);
    }

    it('tells the alarm’s creator in their inbox when a scan flags records', async () => {
        const admin = await seedFlagged(2);
        await createAlarm(admin, 'error');

        const items = (await admin.get('/api/inbox').expect(200)).body.items;
        expect(items).toEqual([
            expect.objectContaining({
                kind: 'alarm.flagged',
                category: 'alarms',
                link: `workspaces/${workspaceId}/alarms`,
                payload: expect.objectContaining({
                    ruleName: 'Flagged error',
                    severity: 'error',
                    newCount: 2
                })
            })
        ]);
        // Nobody else made the alarm.
        const other = await login(OTHER);
        expect((await other.get('/api/inbox').expect(200)).body.items).toEqual(
            []
        );
    });

    it('never asks anybody to act on an info alarm', async () => {
        const admin = await seedFlagged(1);
        await createAlarm(admin, 'info');

        expect((await admin.get('/api/inbox').expect(200)).body.items).toEqual(
            []
        );
        expect(await runAlarmDigest(harness.app, WEDNESDAY_MORNING)).toBe(0);
    });

    it('mails one digest a day, listing what is new', async () => {
        const admin = await seedFlagged(3);
        await createAlarm(admin, 'warn');

        expect(await runAlarmDigest(harness.app, WEDNESDAY_MORNING)).toBe(1);
        // The same period again — another process, another tick — sends nothing.
        expect(await runAlarmDigest(harness.app, WEDNESDAY_MORNING)).toBe(0);

        expect(await digestRows()).toEqual([
            {
                toAddress: ADMIN,
                subject: '3 new alarm findings in 1 workspace'
            }
        ]);
        const [message] = await drainMail(harness.app);
        expect(message.text).toContain('Press');
        expect(message.text).toContain('“Flagged warn” — 3 new, 3 open');
        expect(message.text).toContain('/inbox/settings');
    });

    it('waits for the digest hour', async () => {
        const admin = await seedFlagged(1);
        await createAlarm(admin, 'error');

        expect(
            await runAlarmDigest(
                harness.app,
                new Date('2026-10-28T03:00:00.000Z')
            )
        ).toBe(0);
        expect(await digestRows()).toEqual([]);
    });

    it('honours the person’s own frequency', async () => {
        const admin = await seedFlagged(1);
        await createAlarm(admin, 'error');

        const before = await admin
            .get('/api/alarms/digest/settings')
            .expect(200);
        expect(before.body).toEqual({ frequency: 'daily', available: true });

        await admin
            .put('/api/alarms/digest/settings')
            .send({ frequency: 'off' })
            .expect(200);
        expect(await runAlarmDigest(harness.app, WEDNESDAY_MORNING)).toBe(0);

        await admin
            .put('/api/alarms/digest/settings')
            .send({ frequency: 'weekly' })
            .expect(200);
        // Weekly goes out on Mondays only.
        expect(await runAlarmDigest(harness.app, WEDNESDAY_MORNING)).toBe(0);
        expect(
            await runAlarmDigest(
                harness.app,
                new Date('2026-11-02T09:00:00.000Z')
            )
        ).toBe(1);

        await admin
            .put('/api/alarms/digest/settings')
            .send({ frequency: 'hourly' })
            .expect(400);
    });

    it('sends nothing for a quiet period', async () => {
        const admin = await seedFlagged(1);
        await createAlarm(admin, 'error');
        expect(await runAlarmDigest(harness.app, WEDNESDAY_MORNING)).toBe(1);

        // The next day: nothing new since the last digest.
        expect(
            await runAlarmDigest(
                harness.app,
                new Date('2026-10-29T09:00:00.000Z')
            )
        ).toBe(0);
    });
});
