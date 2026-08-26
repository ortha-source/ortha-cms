/**
 * The **entry-access description port** — the seam a downstream plugin uses to
 * tell a protocol adapter *that* an entry it just served is restricted, without
 * this package knowing what a restriction is.
 *
 * It is the read scope's opposite number and deliberately not the same thing.
 * `CONTENT_READ_SCOPE` decides which rows a reader gets; this describes the rows
 * they got. A scope can only subtract, so by the time an annotation is asked
 * for, the entry has already been admitted — which is why nothing here can
 * refuse anything, and why an implementation that returned nothing would be a
 * missing label rather than a leak.
 *
 * ## What it is for
 *
 * One thing, and it is worth being blunt about it: **a restricted entry must not
 * be cached as public.** A CDN, a shared HTTP cache or a client store that keeps
 * one reader's copy and hands it to the next turns a working entitlement into a
 * data leak, and nothing else in the response says the entry was reader-scoped —
 * it looks exactly like an open one. Everything else an implementation could
 * report (who exactly may read it, which segments) is a question for the admin
 * API, where the caller is a member of the workspace rather than a consumer of
 * its content.
 *
 * ## Why a registry rather than a DI token
 *
 * The same reason the read scope uses one: Nest has **no multi-provider**, so
 * two dynamic modules binding one token do not merge — the second silently
 * replaces the first. Here that would mean an entry that one plugin knows is
 * restricted reported as open because a second plugin was registered after it,
 * which is precisely the mislabelling this port exists to prevent. Registration
 * is a runtime `register(...)` call, the same shape as
 * {@link contentReadScopeRegistrar}.
 *
 * ## The batching constraint
 *
 * `describe` takes the whole page of entry ids, not one. A protocol adapter
 * resolves a list and then labels it; asking per entry would be a query per row
 * on a path whose cost is otherwise one page read. An implementation that cannot
 * answer for an id simply leaves it out of the map, and the caller reads a
 * missing key as unrestricted — the same default absence carries everywhere
 * else in this feature.
 */

import {
    Injectable,
    Logger,
    type OnApplicationBootstrap,
    type Provider,
    type Type
} from '@nestjs/common';

/** What one entry's restriction looks like from outside the plugin that owns it. */
export interface EntryAccessDescription {
    /**
     * Whether anything narrowed who may read this entry.
     *
     * `true` means the response is reader-specific and must not be stored in a
     * shared cache without varying on whatever identifies the reader.
     */
    readonly restricted: boolean;
    /**
     * The axes that took part, as opaque keys (`org`, `plan`). A hint for a
     * client deciding what to vary its own cache on — never the segments
     * themselves, which would tell a consumer who *else* may read the entry.
     */
    readonly dimensions: readonly string[];
}

/** What a source is told about the page it is describing. */
export interface EntryAccessQuery {
    /** The workspace the entries were read in. */
    readonly workspaceId: string;
    /** The ids to describe. Never empty — the caller skips an empty page. */
    readonly entryIds: readonly string[];
}

/**
 * One contributed description of what was served.
 *
 * Returning an empty map means "nothing to say about this page", which is what
 * an installed-but-unconfigured plugin returns and what every entry defaults to.
 */
export interface EntryAccessSource {
    /** Describes the given entries, keyed by entry id. Ids may be omitted. */
    describe(
        query: EntryAccessQuery
    ): Promise<ReadonlyMap<string, EntryAccessDescription>>;
}

/**
 * Every registered source, merged.
 *
 * The merge is a **union that can only tighten**: an entry is restricted if any
 * source says so, and the dimensions are the union of what each reported. Two
 * plugins narrowing reads for different reasons both need to be heard, and the
 * safe direction for a disagreement is the one that keeps a shared cache from
 * storing the entry.
 */
@Injectable()
export class EntryAccessSourceRegistry {
    private readonly sources: EntryAccessSource[] = [];

    /** Adds a source. Registering the same instance twice is a no-op. */
    register(source: EntryAccessSource): void {
        if (!this.sources.includes(source)) {
            this.sources.push(source);
        }
    }

    /** Whether anything is registered — the cheap check before building a page. */
    get active(): boolean {
        return this.sources.length > 0;
    }

    /**
     * Describes one page of entries.
     *
     * Returns an empty map when nothing is registered or the page is empty, so
     * a caller on an installation with no scoping plugin does no work and every
     * entry reads as unrestricted.
     */
    async describe(
        query: EntryAccessQuery
    ): Promise<ReadonlyMap<string, EntryAccessDescription>> {
        if (!this.sources.length || !query.entryIds.length) {
            return new Map();
        }
        const merged = new Map<
            string,
            { restricted: boolean; dimensions: Set<string> }
        >();
        for (const source of this.sources) {
            const described = await source.describe(query);
            for (const [entryId, description] of described) {
                const current = merged.get(entryId) ?? {
                    restricted: false,
                    dimensions: new Set<string>()
                };
                current.restricted ||= description.restricted;
                for (const dimension of description.dimensions) {
                    current.dimensions.add(dimension);
                }
                merged.set(entryId, current);
            }
        }
        return new Map(
            [...merged].map(([entryId, value]) => [
                entryId,
                {
                    restricted: value.restricted,
                    dimensions: [...value.dimensions].sort()
                }
            ])
        );
    }
}

/** Registers a plugin's access sources with content at bootstrap. */
class EntryAccessBootstrapper implements OnApplicationBootstrap {
    private readonly logger = new Logger(EntryAccessBootstrapper.name);

    constructor(
        private readonly label: string,
        private readonly registry: EntryAccessSourceRegistry | null,
        private readonly sources: readonly EntryAccessSource[]
    ) {}

    onApplicationBootstrap(): void {
        // A deployment that does not register `ContentPlugin` is not a real
        // configuration, but a binding plugin should still boot rather than
        // fail on an injection it cannot influence.
        if (!this.registry) {
            return;
        }
        for (const source of this.sources) {
            this.registry.register(source);
        }
        this.logger.log(
            `Registered the ${this.label} entry-access source with the content API.`
        );
    }
}

/**
 * Builds the DI provider that registers `sources` with content's access-source
 * registry at bootstrap.
 *
 * A factory with an explicit `inject` list rather than a class with reflected
 * parameters, for the reason `contentReadScopeRegistrar` documents: an optional
 * dependency typed as `Foo | null` emits `Object` for `design:paramtypes`, Nest
 * injects `undefined` with no error, and the plugin ends up registering
 * nothing.
 */
export function entryAccessSourceRegistrar(
    label: string,
    ...sources: Type<EntryAccessSource>[]
): Provider {
    return {
        provide: `CONTENT_ENTRY_ACCESS_REGISTRAR_${label.toUpperCase()}`,
        useFactory: (
            registry: EntryAccessSourceRegistry | null,
            ...resolved: EntryAccessSource[]
        ) => new EntryAccessBootstrapper(label, registry, resolved),
        inject: [
            { token: EntryAccessSourceRegistry, optional: true },
            ...sources
        ]
    };
}
