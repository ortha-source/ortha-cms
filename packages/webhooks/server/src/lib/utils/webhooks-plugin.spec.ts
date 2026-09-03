// The factory's job at construction time is to refuse a configuration that
// would misbehave quietly. Nothing here needs the Nest module it returns, and
// building one would drag the controllers — and with them the whole identity
// plugin — into a suite about eight numbers.
jest.mock('../webhooks.module', () => ({
    WebhooksModule: { forRoot: () => ({ module: class TestModule {} }) }
}));

import {
    WEBHOOKS_DEFAULTS,
    type WebhooksPluginConfig
} from '../types/webhooks-config';
import { WebhooksPlugin } from './webhooks-plugin';

describe('WebhooksPlugin', () => {
    it('accepts an empty configuration', () => {
        const plugin = WebhooksPlugin();
        expect(plugin.name).toBe('webhooks');
        expect(plugin.migrations?.table).toBe('__drizzle_migrations_webhooks');
    });

    describe('the claim timeout against the request timeout [webhooks:I-16]', () => {
        // A claim that expires while a request is still in flight is reclaimed
        // by another worker and the delivery is sent twice — to someone else's
        // system, from a log that will say it was sent once. There is no
        // runtime signal for it, which is why it is a boot refusal.

        it('refuses a claim timeout below the request timeout', () => {
            expect(() =>
                WebhooksPlugin({ timeoutMs: 20_000, claimTimeoutMs: 10_000 })
            ).toThrow(/claimTimeoutMs/);
        });

        it('refuses them being equal — the reclaim would be a coin toss', () => {
            expect(() =>
                WebhooksPlugin({ timeoutMs: 10_000, claimTimeoutMs: 10_000 })
            ).toThrow(/claimTimeoutMs/);
        });

        it('compares against the defaults, not only against what was passed', () => {
            // Raising the request timeout alone is the realistic way into this:
            // the claim timeout is left at its 30 s default and is now the
            // shorter of the two, and nothing in the call site says so.
            expect(() =>
                WebhooksPlugin({
                    timeoutMs: WEBHOOKS_DEFAULTS.claimTimeoutMs + 1_000
                })
            ).toThrow(/claimTimeoutMs/);

            expect(() =>
                WebhooksPlugin({
                    claimTimeoutMs: WEBHOOKS_DEFAULTS.timeoutMs - 1_000
                })
            ).toThrow(/claimTimeoutMs/);
        });

        it('accepts a claim timeout that merely exceeds it', () => {
            expect(() =>
                WebhooksPlugin({ timeoutMs: 10_000, claimTimeoutMs: 10_001 })
            ).not.toThrow();
        });

        it('names both numbers, so the message is actionable', () => {
            expect(() =>
                WebhooksPlugin({ timeoutMs: 20_000, claimTimeoutMs: 15_000 })
            ).toThrow(/15000.*20000|20000.*15000/);
        });
    });

    describe('the numeric bounds', () => {
        // A zero `batchSize` is a worker that claims nothing and looks exactly
        // like a worker with nothing to do; a zero `maxAttempts` is a delivery
        // that is dead on arrival. Neither has a symptom worth diagnosing from
        // a delivery log.
        it.each<[string, WebhooksPluginConfig]>([
            ['batchSize', { batchSize: 0 }],
            ['timeoutMs', { timeoutMs: 0 }],
            ['maxAttempts', { maxAttempts: 0 }],
            ['autoDisableAfter', { autoDisableAfter: 0 }],
            ['responseSnippetBytes', { responseSnippetBytes: 0 }]
        ])('refuses a zero %s', (key, config) => {
            expect(() => WebhooksPlugin(config)).toThrow(
                new RegExp(`${key}.*positive integer`)
            );
        });

        // These two are the exception, and deliberately so: "do not send from
        // this process" and "keep the log forever" are both things a
        // deployment means on purpose.
        it.each<[string, WebhooksPluginConfig]>([
            ['deliveryIntervalMs', { deliveryIntervalMs: 0 }],
            ['retentionDays', { retentionDays: 0 }]
        ])('accepts a zero %s, which is a real choice', (_key, config) => {
            expect(() => WebhooksPlugin(config)).not.toThrow();
        });

        it.each<[string, WebhooksPluginConfig]>([
            ['deliveryIntervalMs', { deliveryIntervalMs: -1 }],
            ['retentionDays', { retentionDays: -1 }]
        ])('still refuses a negative %s', (key, config) => {
            expect(() => WebhooksPlugin(config)).toThrow(
                new RegExp(`${key}.*non-negative integer`)
            );
        });

        it('refuses a fractional value', () => {
            expect(() => WebhooksPlugin({ batchSize: 2.5 })).toThrow(
                /batchSize/
            );
        });
    });
});
