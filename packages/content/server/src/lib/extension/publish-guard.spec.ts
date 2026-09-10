import {
    ContentPublishGuardRegistry,
    contentPublishGuardRegistrar,
    type ContentPublishGuard,
    type ContentPublishGuardContext,
    type PublishVerdict
} from './publish-guard';
import type { AnyContentType } from '../types/content-type';

const context = (
    overrides: Partial<ContentPublishGuardContext> = {}
): ContentPublishGuardContext => ({
    type: { name: 'article' } as unknown as AnyContentType,
    entryId: 'entry-1',
    workspaceId: 'ws-1',
    actor: { userId: 'anna', isToken: false },
    ...overrides
});

/** A guard that answers whatever it was built with, and counts its calls. */
class ScriptedGuard implements ContentPublishGuard {
    calls = 0;
    constructor(private readonly verdict: PublishVerdict) {}
    async check(): Promise<PublishVerdict> {
        this.calls += 1;
        return this.verdict;
    }
}

const refusal = (code: string): PublishVerdict => ({
    allowed: false,
    status: 409,
    code,
    message: `refused by ${code}`
});

describe('ContentPublishGuardRegistry', () => {
    /**
     * Invariant I-01, and the reason this file exists. A host that never
     * registers a guarding plugin must run the publish path it ran before the
     * port was declared — not "the same outcome after one extra query", the
     * same path.
     */
    it('allows the publish when nothing is registered [protection:I-01]', async () => {
        const registry = new ContentPublishGuardRegistry();

        expect(registry.all()).toEqual([]);
        await expect(registry.check(context())).resolves.toEqual({
            allowed: true
        });
    });

    it('consults every registered guard when they all allow', async () => {
        const registry = new ContentPublishGuardRegistry();
        const first = new ScriptedGuard({ allowed: true });
        const second = new ScriptedGuard({ allowed: true });
        registry.register(first);
        registry.register(second);

        await expect(registry.check(context())).resolves.toEqual({
            allowed: true
        });
        expect([first.calls, second.calls]).toEqual([1, 1]);
    });

    /** Any refusal refuses: the fragments are AND-ed, like a read scope's. */
    it('returns the first refusal and asks no further guard', async () => {
        const registry = new ContentPublishGuardRegistry();
        const refusing = new ScriptedGuard(refusal('first.no'));
        const later = new ScriptedGuard(refusal('second.no'));
        registry.register(refusing);
        registry.register(later);

        await expect(registry.check(context())).resolves.toMatchObject({
            allowed: false,
            code: 'first.no'
        });
        // Not merely unused — a guard that runs after the answer is settled can
        // still write, and one of these is allowed to record a bypass.
        expect(later.calls).toBe(0);
    });

    it('refuses when a later guard refuses what an earlier one allowed', async () => {
        const registry = new ContentPublishGuardRegistry();
        registry.register(new ScriptedGuard({ allowed: true }));
        registry.register(new ScriptedGuard(refusal('second.no')));

        await expect(registry.check(context())).resolves.toMatchObject({
            allowed: false,
            code: 'second.no'
        });
    });

    it('collects the events allowing guards asked to have committed', async () => {
        const registry = new ContentPublishGuardRegistry();
        const event = {
            kind: 'entry.publish_bypassed',
            payload: {}
        } as never;
        registry.register(
            new ScriptedGuard({ allowed: true, events: [event] })
        );
        registry.register(new ScriptedGuard({ allowed: true }));

        await expect(registry.check(context())).resolves.toEqual({
            allowed: true,
            events: [event]
        });
    });

    it('carries no events when no guard contributed any', async () => {
        const registry = new ContentPublishGuardRegistry();
        registry.register(new ScriptedGuard({ allowed: true, events: [] }));

        await expect(registry.check(context())).resolves.toEqual({
            allowed: true
        });
    });

    it('registers the same guard instance only once', () => {
        const registry = new ContentPublishGuardRegistry();
        const guard = new ScriptedGuard({ allowed: true });
        registry.register(guard);
        registry.register(guard);

        expect(registry.all()).toEqual([guard]);
    });
});

describe('contentPublishGuardRegistrar', () => {
    /**
     * The failure this shape exists to prevent: an optional dependency typed
     * `Foo | null` reflects as `Object`, Nest injects `undefined` without
     * error, and the plugin registers nothing — a publish rule that silently
     * stopped applying, arriving as a successful boot.
     */
    it('marks the registry optional and lists every guard to inject', () => {
        class A implements ContentPublishGuard {
            async check(): Promise<PublishVerdict> {
                return { allowed: true };
            }
        }
        const provider = contentPublishGuardRegistrar('protection', A) as {
            provide: string;
            inject: unknown[];
            useFactory: (...args: unknown[]) => unknown;
        };

        expect(provider.provide).toBe(
            'CONTENT_PUBLISH_GUARD_REGISTRAR_PROTECTION'
        );
        expect(provider.inject[0]).toEqual({
            token: ContentPublishGuardRegistry,
            optional: true
        });
        expect(provider.inject[1]).toBe(A);
    });

    it('registers its guards with the registry at bootstrap', () => {
        const registry = new ContentPublishGuardRegistry();
        const guard = new ScriptedGuard({ allowed: true });
        const provider = contentPublishGuardRegistrar('protection') as {
            useFactory: (
                registry: ContentPublishGuardRegistry | null,
                ...guards: ContentPublishGuard[]
            ) => OnBootstrap;
        };

        provider.useFactory(registry, guard).onApplicationBootstrap();

        expect(registry.all()).toEqual([guard]);
    });

    /** A binding plugin without `ContentPlugin` boots; it just registers nothing. */
    it('does not throw when content is absent', () => {
        const provider = contentPublishGuardRegistrar('protection') as {
            useFactory: (
                registry: ContentPublishGuardRegistry | null,
                ...guards: ContentPublishGuard[]
            ) => OnBootstrap;
        };

        expect(() =>
            provider
                .useFactory(null, new ScriptedGuard({ allowed: true }))
                .onApplicationBootstrap()
        ).not.toThrow();
    });
});

/** The bootstrapper's shape, as the factory returns it. */
interface OnBootstrap {
    onApplicationBootstrap(): void;
}
