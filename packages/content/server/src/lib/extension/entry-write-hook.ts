/**
 * The **entry write hook** — the seam a downstream plugin uses to do work
 * *inside* an entry's write transaction.
 *
 * The read-scope port's sibling, and it exists for the same reason the read one
 * does: a plugin that derives something from an entry has to derive it where the
 * entry is written, or the two can disagree. `@orthacms/segments-server` uses it
 * to write an entry's access projection, and the window between "the entry is
 * live" and "the rule that hides it is recorded" is exactly the window in which
 * restricted content is public.
 *
 * ## Why not `CONTENT_ENTRY_EXTENSION.afterUpdate`
 *
 * That hook does precisely this job and would need no new code — except that the
 * port is documented as a **single binding**, one provider per app, and i18n
 * holds it. Its own note suggests a composite for a second consumer, which is
 * fine when the two are peers; here they are not. i18n's implementation returns
 * the sibling rows it rewrote, and the writer snapshots a revision for each; a
 * composite would have to merge that return value with a second implementation
 * that has no opinion about it, and a mistake there writes the wrong revision
 * history. This port returns nothing and cannot participate in that decision.
 *
 * ## The contract
 *
 * **Runs in the write's own transaction.** The executor handed to the hook is
 * the transaction the row was written in, and a throw rolls the write back with
 * it. That is the guarantee the hook exists for: an entry and whatever a plugin
 * derives from it commit together or not at all.
 *
 * **Runs after the row and its relations are written**, so the hook sees the
 * entry in its final state — including any columns the entries extension
 * stamped or rewrote.
 *
 * **Must be cheap.** It is on the write path of every create and update, and it
 * holds the entry's advisory lock while it runs. Work that can wait for a
 * commit does not belong here; work that must not be observed separately from
 * the write does.
 *
 * **Deletes are not hooked.** A hard-deleted entry's derived rows are
 * unreachable — nothing joins to an id that no longer exists — so the cost of
 * leaving them is disk rather than correctness, and paying for a hook on every
 * delete to reclaim it is the wrong trade. A plugin that cares reclaims them on
 * its own schedule.
 */

import {
    Injectable,
    Logger,
    type OnApplicationBootstrap,
    type Provider,
    type Type
} from '@nestjs/common';
import type { Database } from '@orthacms/database';
import type { AnyContentType } from '../types/content-type';

/** The executor the hook must use — the write's own transaction. */
export type EntryWriteExecutor = Parameters<
    Parameters<Database['transaction']>[0]
>[0];

/** What a hook is told about the write it is running inside. */
export interface ContentEntryWriteContext {
    /** The write's transaction. Use this, never the shared connection. */
    readonly tx: EntryWriteExecutor;
    /** The content type written. */
    readonly type: AnyContentType;
    /** The entry's id. */
    readonly entryId: string;
    /** The workspace the entry belongs to. */
    readonly workspaceId: string;
    /** True when the row was just INSERTed; false on an update. */
    readonly created: boolean;
}

/** One plugin's participation in an entry write. */
export interface ContentEntryWriteHook {
    /**
     * Runs inside the write transaction, after the row and its relations.
     *
     * A throw rolls the entry write back. That is deliberate: a hook whose
     * failure is swallowed would let the entry commit without whatever the hook
     * was meant to derive from it.
     */
    afterWrite(context: ContentEntryWriteContext): Promise<void>;
}

/** Every registered write hook, in registration order. */
@Injectable()
export class ContentEntryWriteHookRegistry {
    private readonly hooks: ContentEntryWriteHook[] = [];

    /** Adds a hook. Registering the same instance twice is a no-op. */
    register(hook: ContentEntryWriteHook): void {
        if (!this.hooks.includes(hook)) {
            this.hooks.push(hook);
        }
    }

    /** Every registered hook. Empty on an installation with none. */
    all(): readonly ContentEntryWriteHook[] {
        return this.hooks;
    }

    /**
     * Runs every hook, in order, inside the caller's transaction.
     *
     * Sequential rather than concurrent: the hooks share one transaction, and a
     * Postgres connection carries one statement at a time — firing them at once
     * would only interleave their awaits onto the same connection.
     */
    async run(context: ContentEntryWriteContext): Promise<void> {
        for (const hook of this.hooks) {
            await hook.afterWrite(context);
        }
    }
}

/** Registers a plugin's write hooks with content at bootstrap. */
class WriteHookBootstrapper implements OnApplicationBootstrap {
    private readonly logger = new Logger(WriteHookBootstrapper.name);

    constructor(
        private readonly label: string,
        private readonly registry: ContentEntryWriteHookRegistry | null,
        private readonly hooks: readonly ContentEntryWriteHook[]
    ) {}

    onApplicationBootstrap(): void {
        if (!this.registry) {
            return;
        }
        for (const hook of this.hooks) {
            this.registry.register(hook);
        }
        this.logger.log(
            `Registered the ${this.label} entry write hook with the content API.`
        );
    }
}

/**
 * Builds the DI provider that registers `hooks` with content's write-hook
 * registry at bootstrap. The sibling of `contentReadScopeRegistrar`, and a
 * factory with an explicit `inject` list for the same reason: a reflected
 * `Foo | null` parameter type emits `Object`, Nest injects `undefined`, and the
 * plugin silently registers nothing.
 */
export function contentEntryWriteHookRegistrar(
    label: string,
    ...hooks: Type<ContentEntryWriteHook>[]
): Provider {
    return {
        provide: `CONTENT_ENTRY_WRITE_HOOK_REGISTRAR_${label.toUpperCase()}`,
        useFactory: (
            registry: ContentEntryWriteHookRegistry | null,
            ...resolved: ContentEntryWriteHook[]
        ) => new WriteHookBootstrapper(label, registry, resolved),
        inject: [
            { token: ContentEntryWriteHookRegistry, optional: true },
            ...hooks
        ]
    };
}
