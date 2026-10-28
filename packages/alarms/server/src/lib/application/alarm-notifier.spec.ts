import { AlarmNotifier } from './alarm-notifier';
import type { AlarmRuleRecord } from '../infrastructure/alarm-rule.repository';

const registry = {
    get: (name: string) =>
        name === 'article' ? { label: 'Articles' } : undefined
};

const rule: AlarmRuleRecord = {
    id: 'rule-1',
    workspaceId: 'ws-1',
    contentType: 'article',
    name: 'Author is not published',
    findingTitle: 'Author is not published',
    severity: 'error',
    filter: {},
    enabled: true,
    brokenReason: null,
    createdBy: 'anna'
};

function make() {
    const delivered: unknown[] = [];
    const notifier = new AlarmNotifier(registry as never, {
        deliver: async (items) => {
            delivered.push(...items);
        }
    });
    return { notifier, delivered };
}

describe('AlarmNotifier', () => {
    it('tells the alarm’s creator how many records were newly flagged', async () => {
        const { notifier, delivered } = make();

        await notifier.flagged(rule, 3);

        expect(delivered).toEqual([
            expect.objectContaining({
                kind: 'alarm.flagged',
                userId: 'anna',
                workspaceId: 'ws-1',
                link: 'workspaces/ws-1/alarms',
                payload: {
                    ruleId: 'rule-1',
                    ruleName: 'Author is not published',
                    severity: 'error',
                    contentType: 'article',
                    contentTypeLabel: 'Articles',
                    newCount: 3
                }
            })
        ]);
    });

    it.each([
        ['nothing new opened', rule, 0],
        ['the alarm is info', { ...rule, severity: 'info' as const }, 2],
        ['nobody is known to have made it', { ...rule, createdBy: null }, 2]
    ])('stays quiet when %s', async (_why, subject, opened) => {
        const { notifier, delivered } = make();

        await notifier.flagged(subject, opened);

        expect(delivered).toEqual([]);
    });

    it('is a no-op without the inbox plugin', async () => {
        const notifier = new AlarmNotifier(registry as never);
        await expect(notifier.flagged(rule, 3)).resolves.toBeUndefined();
    });
});
