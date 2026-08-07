import type {
    CopilotToolProvider,
    ToolSpec
} from '@ortha-cms/copilot-domain';

/**
 * Fixture tools, registered by the copilot suite only.
 *
 * They exist because phase 1 ships **no write tools at all** — every real tool
 * is `content:read`. Without something that mutates, "a viewer is offered no
 * write tools" would be a vacuously passing assertion, and ADR-0005 is explicit
 * that this negative path is mandatory rather than nice to have. These give it
 * something real to be false about, and let the `apply`-not-opted-in branch be
 * exercised end to end instead of only in the domain unit test.
 */
export class FixtureToolProvider implements CopilotToolProvider {
    /** Names of tools whose `run` was actually invoked, in order. */
    readonly invoked: string[] = [];

    tools(): readonly ToolSpec[] {
        return [
            {
                name: 'fixture.readThing',
                description: 'A read tool any role with content:read may use.',
                inputSchema: {
                    type: 'object',
                    properties: { q: { type: 'string' } },
                    required: ['q'],
                    additionalProperties: false
                },
                permissions: ['content:read'],
                effect: 'read',
                run: async (input) => {
                    this.invoked.push('fixture.readThing');
                    return { echoed: (input as { q: string }).q, total: 3 };
                }
            },
            {
                name: 'fixture.proposeThing',
                description: 'A propose tool needing content:update.',
                inputSchema: { type: 'object', properties: {} },
                permissions: ['content:update'],
                effect: 'propose',
                run: async () => {
                    this.invoked.push('fixture.proposeThing');
                    return { proposed: true };
                }
            },
            {
                name: 'fixture.applyThing',
                description: 'An apply tool needing content:update.',
                inputSchema: { type: 'object', properties: {} },
                permissions: ['content:update'],
                effect: 'apply',
                run: async () => {
                    this.invoked.push('fixture.applyThing');
                    return { applied: true };
                }
            },
            {
                name: 'fixture.explodes',
                description: 'A read tool that always throws.',
                inputSchema: { type: 'object', properties: {} },
                permissions: ['content:read'],
                effect: 'read',
                run: async () => {
                    this.invoked.push('fixture.explodes');
                    throw new Error('the tool blew up');
                }
            }
        ];
    }
}
