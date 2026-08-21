import type { ContentTypeRegistry } from '@orthacms/content-server';
import type { GraphQLSchema } from 'graphql';
import { buildContentSchema } from './build-schema';

/**
 * Memoises built schemas by grant set.
 *
 * Building a schema walks every granted type's fields and allocates a few dozen
 * GraphQL type objects — cheap, but not per-request cheap, and a deployment has
 * only as many distinct grant sets as it has workspace configurations. The key
 * is the sorted grant list, so two workspaces granted the same content share one
 * schema.
 *
 * **The TTL is a freshness knob, not a security boundary.** A revoked grant
 * stops being *described* within the TTL; it stops being *readable*
 * immediately, because every resolver re-checks the live grant set through
 * `resolveGrantedType`. Getting that the wrong way round — treating the cached
 * schema as the authorization — is the mistake this comment exists to prevent.
 */
export class SchemaCache {
    private readonly entries = new Map<string, CachedSchema>();

    constructor(
        private readonly registry: ContentTypeRegistry,
        private readonly ttlMs: number,
        /** Injectable clock, so the expiry is testable without waiting. */
        private readonly now: () => number = Date.now
    ) {}

    /** The schema for `granted`, built or reused. */
    get(granted: ReadonlySet<string>): GraphQLSchema {
        const key = [...granted].sort().join('\u0000');
        const cached = this.entries.get(key);
        const now = this.now();
        if (cached && cached.expiresAt > now) {
            return cached.schema;
        }
        const schema = buildContentSchema(this.registry, granted);
        this.entries.set(key, { schema, expiresAt: now + this.ttlMs });
        return schema;
    }

    /** Drops every cached schema. For tests, and for a future grant-change hook. */
    clear(): void {
        this.entries.clear();
    }
}

/** One cached schema and when it goes stale. */
interface CachedSchema {
    schema: GraphQLSchema;
    expiresAt: number;
}
