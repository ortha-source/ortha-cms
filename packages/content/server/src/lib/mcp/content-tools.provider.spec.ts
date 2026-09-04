import { NotFoundException } from '@nestjs/common';
import type { ToolContext, ToolDefinition } from '@orthacms/tools-server';
import type { ContentTypeRegistry } from '../registry/content-type-registry';
import type { WorkspaceGrantsQuery } from '../content-types/queries/workspace-grants.query';
import type { PublicEntriesQuery } from '../public-api/infrastructure/public-entries.query';
import type { PublicEntryWritesService } from '../public-api/infrastructure/public-entry-writes.service';
import { ContentToolProvider } from './content-tools.provider';

/**
 * The grant gate on the **resource** path.
 *
 * `resources/read` is the one way into this provider that does not pass through
 * `ToolRegistry.call`, so it is the one place a missing check would not be
 * caught by the tool authorization the registry owns. The rule
 * (`mcp:I-23`) is deliberately narrow: a content type the workspace was **not
 * granted** must answer a `resources/read` exactly as a type that does not
 * exist, so a client cannot enumerate the content model by asking for schemas
 * one URI at a time.
 *
 * ## Why the fixture is shaped the way it is
 *
 * "Indistinguishable" is a claim about **one name asked in two worlds**, not
 * about two names asked in one. The refusal embeds the name that was asked for
 * (`Unknown content type "x".`), so comparing the answer for an ungranted `x`
 * against the answer for an unknown `y` compares two sentences that differ by
 * construction and proves nothing either way. So each case below builds two
 * providers — one where `test_ungranted` is registered and withheld, one where
 * it was never registered — and asks both for the same URI.
 *
 * That distinction is exactly what the server-e2e suite is missing today: its
 * `-32002` case reads `ortha://content-type/never_granted`, a name no registry
 * holds, which pins *unknown URI* and would pass unchanged against a
 * `readResource` that consulted no grant set at all. Only a type that exists
 * and was withheld can tell the gate apart from its absence.
 */

/** A serialized type as the registry hands it over, minimal but real-shaped. */
const serialized = (name: string) => ({
    name,
    label: name,
    kind: 'collection' as const,
    publishable: false,
    localized: false,
    softDelete: false,
    fields: []
});

/** A provider, plus the record of what its registry was asked to serialize. */
interface World {
    provider: ContentToolProvider;
    /** Every type name `describeType` reached the registry for. */
    serializedNames: string[];
}

/**
 * A provider over a registry holding `registered` and a workspace granted
 * `granted`.
 */
function world(registered: string[], granted: string[]): World {
    const serializedNames: string[] = [];

    const registry = {
        get: (name: string) => (registered.includes(name) ? { name } : undefined),
        summaries: () => registered.map(serialized),
        serialize: (name: string) => {
            serializedNames.push(name);
            return registered.includes(name) ? serialized(name) : undefined;
        }
    } as unknown as ContentTypeRegistry;

    const grants = {
        grantedSlugs: async () => new Set(granted)
    } as unknown as WorkspaceGrantsQuery;

    // Neither entry service is reachable from the two paths under test:
    // `content_type_get` and `readResource` go registry + grants and stop. A
    // stub that throws says so loudly if that ever stops being true.
    const unreachable = new Proxy(
        {},
        {
            get() {
                throw new Error(
                    'the schema paths must not reach the entry services'
                );
            }
        }
    );

    return {
        provider: new ContentToolProvider(
            registry,
            grants,
            unreachable as PublicEntriesQuery,
            unreachable as PublicEntryWritesService
        ),
        serializedNames
    };
}

/** The type is registered but the workspace was never granted it. */
const withheld = () => world(['test_granted', 'test_ungranted'], ['test_granted']);

/** The same name, in a deployment where no such content type was ever defined. */
const nonexistent = () => world(['test_granted'], ['test_granted']);

const UNGRANTED_URI = 'ortha://content-type/test_ungranted';

/** A context holding every permission, so nothing but the grant gate can refuse. */
function context(): ToolContext {
    return {
        actor: {
            kind: 'token',
            id: 'token-1',
            displayName: 'test token',
            grantedPermissions: new Set<string>(),
            userId: null
        },
        workspaceId: 'workspace-1',
        surface: 'mcp',
        can: () => true
    };
}

/** The error a call threw, or `null` if it did not throw. */
async function refusal(run: () => Promise<unknown>): Promise<Error | null> {
    try {
        await run();
        return null;
    } catch (error) {
        return error as Error;
    }
}

describe('ContentToolProvider resource reads', () => {
    it('serves the schema of a type the workspace was granted', async () => {
        // The control. Without it every assertion below is satisfied by a
        // `readResource` that refuses everything, which is not the invariant —
        // and the "was it serialized?" recorder would never fire.
        const { provider, serializedNames } = withheld();

        await expect(
            provider.readResource(
                'ortha://content-type/test_granted',
                context()
            )
        ).resolves.toMatchObject({
            uri: 'ortha://content-type/test_granted',
            mimeType: 'application/json'
        });
        expect(serializedNames).toEqual(['test_granted']);
    });

    it('refuses a type that exists but was not granted [mcp:I-23]', async () => {
        const error = await refusal(() =>
            withheld().provider.readResource(UNGRANTED_URI, context())
        );

        expect(error).toBeInstanceOf(NotFoundException);
    });

    it('answers it exactly as a deployment where the type never existed [mcp:I-23]', async () => {
        // The same URI, asked of two worlds that differ only in whether the
        // type is defined at all. Both answers must be the same class and the
        // same sentence: a refusal that said "not granted", or named the type
        // as known-but-withheld, would let a client walk the content model one
        // schema URI at a time.
        const viaWithheld = await refusal(() =>
            withheld().provider.readResource(UNGRANTED_URI, context())
        );
        const viaNonexistent = await refusal(() =>
            nonexistent().provider.readResource(UNGRANTED_URI, context())
        );

        expect(viaWithheld).toBeInstanceOf(NotFoundException);
        expect(viaNonexistent).toBeInstanceOf(NotFoundException);
        expect(viaWithheld?.message).toBe(viaNonexistent?.message);
    });

    it('answers a resource read exactly as it answers the equivalent tool call [mcp:I-23]', async () => {
        // The invariant's own wording: an ungranted type 404s on
        // `resources/read` *exactly as it does on a tool call*.
        // `content_type_get` returns the same schema for the same type, so it
        // is the tool to compare against — a resource path resolving through
        // anything but the tools' own gate would drift from it here.
        const { provider } = withheld();
        const typeGet = provider
            .tools()
            .find(
                (tool: ToolDefinition) => tool.name === 'content_type_get'
            ) as ToolDefinition;

        const viaTool = await refusal(() =>
            typeGet.handler({ typeName: 'test_ungranted' }, context())
        );
        const viaResource = await refusal(() =>
            provider.readResource(UNGRANTED_URI, context())
        );

        expect(viaTool).toBeInstanceOf(NotFoundException);
        expect(viaResource).toBeInstanceOf(NotFoundException);
        expect(viaResource?.message).toBe(viaTool?.message);
    });

    it('builds no schema for a type it is about to refuse [mcp:I-23]', async () => {
        // The ordering half, at the provider. `describeType` is what turns a
        // registered type into bytes, and it must not run for a type the grant
        // set withheld: a gate applied to the *result* would answer the same
        // 404 having already assembled the schema. The granted case above
        // proves the recorder fires when the read does go through.
        const { provider, serializedNames } = withheld();

        await refusal(() => provider.readResource(UNGRANTED_URI, context()));

        expect(serializedNames).toEqual([]);
    });

    it('claims no uri outside its own prefix', async () => {
        // The registry walks every provider until one answers, so returning
        // `undefined` for a foreign URI is what lets another provider own it —
        // and what makes the registry's own "Unknown resource" 404 reachable.
        await expect(
            withheld().provider.readResource(
                'ortha://media-asset/1',
                context()
            )
        ).resolves.toBeUndefined();
    });
});
