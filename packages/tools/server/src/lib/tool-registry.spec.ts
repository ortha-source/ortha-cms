import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PERMISSIONS } from '@ortha-cms/identity-server';
import { createToolContext } from './tool-context';
import type { ToolContext, ToolDefinition } from './tool';
import type { ToolProvider } from './tool-provider';
import { ToolRegistry } from './tool-registry';

/** A context holding exactly the named permissions. */
function contextWith(...permissions: string[]): ToolContext {
    return createToolContext(
        {
            kind: 'token',
            id: 'token-1',
            displayName: 'test token',
            grantedPermissions: new Set(permissions),
            userId: null
        },
        'workspace-1'
    );
}

/** A tool that records whether it ran. */
function tool(
    name: string,
    requires: ToolDefinition['requires'],
    ran: { value: boolean } = { value: false }
): ToolDefinition {
    return {
        name,
        title: name,
        description: name,
        inputSchema: { type: 'object' },
        requires,
        readOnly: true,
        handler: async () => {
            ran.value = true;
            return { ok: true };
        }
    };
}

/** A provider wrapping a fixed tool list. */
function provider(...tools: ToolDefinition[]): ToolProvider {
    return { tools: () => tools };
}

describe('ToolRegistry', () => {
    let registry: ToolRegistry;

    beforeEach(() => {
        registry = new ToolRegistry();
    });

    describe('authorization', () => {
        // The security boundary. `visibleTo` only hides tools; a client is
        // free to call a name it was never shown, so the gate has to be here.
        it('refuses a tool the actor lacks the permission for', async () => {
            const ran = { value: false };
            registry.register(
                provider(
                    tool('content_create', [PERMISSIONS.CONTENT_CREATE], ran)
                )
            );

            await expect(
                registry.call(
                    'content_create',
                    {},
                    contextWith(PERMISSIONS.CONTENT_READ)
                )
            ).rejects.toBeInstanceOf(ForbiddenException);
            expect(ran.value).toBe(false);
        });

        it('refuses a tool a hidden-from-list actor invokes by name', async () => {
            const ran = { value: false };
            registry.register(
                provider(
                    tool('content_delete', [PERMISSIONS.CONTENT_DELETE], ran)
                )
            );
            const readOnly = contextWith(PERMISSIONS.CONTENT_READ);

            // Not listed...
            expect(registry.visibleTo(readOnly)).toHaveLength(0);
            // ...and still refused when called anyway.
            await expect(
                registry.call('content_delete', {}, readOnly)
            ).rejects.toBeInstanceOf(ForbiddenException);
            expect(ran.value).toBe(false);
        });

        it('requires EVERY permission a tool declares', async () => {
            registry.register(
                provider(
                    tool('content_media', [
                        PERMISSIONS.CONTENT_READ,
                        PERMISSIONS.MEDIA_READ
                    ])
                )
            );

            await expect(
                registry.call(
                    'content_media',
                    {},
                    contextWith(PERMISSIONS.CONTENT_READ)
                )
            ).rejects.toBeInstanceOf(ForbiddenException);

            await expect(
                registry.call(
                    'content_media',
                    {},
                    contextWith(
                        PERMISSIONS.CONTENT_READ,
                        PERMISSIONS.MEDIA_READ
                    )
                )
            ).resolves.toEqual({ ok: true });
        });

        it('runs a tool the actor is permitted to call', async () => {
            const ran = { value: false };
            registry.register(
                provider(tool('content_list', [PERMISSIONS.CONTENT_READ], ran))
            );

            await expect(
                registry.call(
                    'content_list',
                    {},
                    contextWith(PERMISSIONS.CONTENT_READ)
                )
            ).resolves.toEqual({ ok: true });
            expect(ran.value).toBe(true);
        });

        it('allows a tool that requires nothing', async () => {
            registry.register(provider(tool('ping', [])));

            await expect(
                registry.call('ping', {}, contextWith())
            ).resolves.toEqual({ ok: true });
        });
    });

    describe('visibleTo', () => {
        it('shows a read token only the read tools', () => {
            registry.register(
                provider(
                    tool('content_list', [PERMISSIONS.CONTENT_READ]),
                    tool('content_create', [PERMISSIONS.CONTENT_CREATE]),
                    tool('content_delete', [PERMISSIONS.CONTENT_DELETE])
                )
            );

            expect(
                registry
                    .visibleTo(contextWith(PERMISSIONS.CONTENT_READ))
                    .map((entry) => entry.name)
            ).toEqual(['content_list']);
        });
    });

    describe('call', () => {
        it('404s an unknown tool, distinctly from a refusal', async () => {
            registry.register(provider(tool('content_list', [])));

            await expect(
                registry.call('content_teleport', {}, contextWith())
            ).rejects.toBeInstanceOf(NotFoundException);
        });
    });

    describe('all', () => {
        it('concatenates every provider in registration order', () => {
            registry.register(provider(tool('a', [])));
            registry.register(provider(tool('b', []), tool('c', [])));

            expect(registry.all().map((entry) => entry.name)).toEqual([
                'a',
                'b',
                'c'
            ]);
        });

        // Silently letting one win would make behaviour depend on plugin
        // registration order — the exact class of bug this fails loudly for.
        it('throws when two providers claim the same tool name', () => {
            registry.register(provider(tool('content_list', [])));
            registry.register(provider(tool('content_list', [])));

            expect(() => registry.all()).toThrow(/Duplicate tool name/);
        });
    });

    describe('resources', () => {
        it('404s a uri no provider claims', async () => {
            registry.register(provider(tool('a', [])));

            await expect(
                registry.readResource('ortha://nope', contextWith())
            ).rejects.toBeInstanceOf(NotFoundException);
        });

        it('returns the first provider that claims the uri', async () => {
            const contents = {
                uri: 'ortha://content-type/article',
                mimeType: 'application/json',
                text: '{}'
            };
            registry.register({
                tools: () => [],
                readResource: async () => undefined
            });
            registry.register({
                tools: () => [],
                readResource: async (uri) =>
                    uri === contents.uri ? contents : undefined
            });

            await expect(
                registry.readResource(contents.uri, contextWith())
            ).resolves.toEqual(contents);
        });

        it('flattens resource lists across providers', async () => {
            const one = {
                uri: 'ortha://a',
                name: 'a',
                description: 'a',
                mimeType: 'application/json'
            };
            const two = { ...one, uri: 'ortha://b', name: 'b' };
            registry.register({
                tools: () => [],
                resources: async () => [one]
            });
            registry.register({
                tools: () => [],
                resources: async () => [two]
            });

            await expect(registry.resources(contextWith())).resolves.toEqual([
                one,
                two
            ]);
        });
    });
});
