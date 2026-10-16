/**
 * The content writes every phase shares, by entry **key**: create, edit,
 * publish, unpublish, trash, restore, restore a revision.
 *
 * All of them go through the services the HTTP routes use, so each write
 * appends its revision, raises its outbox event and is attributed to a person.
 * `update` replaces the whole values bag, so this keeps the last values of
 * every entry and merges an edit onto them — a phase says what changed.
 */
import { EntryWriterService } from '@orthacms/content-server';
import type { EventActor } from '@orthacms/database';
import { PublishEntryUseCase } from '../../../../packages/content/server/src/lib/entries/application/use-cases/publish-entry.use-case';
import { UnpublishEntryUseCase } from '../../../../packages/content/server/src/lib/entries/application/use-cases/unpublish-entry.use-case';
import { RestoreRevisionUseCase } from '../../../../packages/content/server/src/lib/revisions/application/use-cases/restore-revision.use-case';
import type { SeedContext } from './context';

type Relations = Record<
    string,
    {
        link?: string[];
        unlink?: string[];
        order?: string[];
        set?: string | null;
    }
>;

export interface CreateOptions {
    /** Workspace key; `main` when omitted. */
    in?: string;
    /** User key the write is attributed to; `admin` when omitted. */
    as?: string;
    relations?: Relations;
    /** Locale of the row, for an `i18n` type. */
    locale?: string;
    /** Entry key of a sibling to join its translation group. */
    translationOf?: string;
}

/** Re-throws with the entry key and the validator's own answer attached. */
async function explain<T>(
    what: string,
    key: string,
    write: () => Promise<T>
): Promise<T> {
    try {
        return await write();
    } catch (error) {
        const response = (
            error as { getResponse?: () => unknown }
        ).getResponse?.();
        throw new Error(
            `[seed] ${what} "${key}" failed: ${error instanceof Error ? error.message : String(error)}` +
                (response ? `\n${JSON.stringify(response, null, 2)}` : ''),
            { cause: error }
        );
    }
}

/**
 * Last values by entry key, per seed run — shared by every writer so a later
 * phase can edit an entry an earlier one created.
 */
const lastValues = new WeakMap<
    SeedContext,
    Map<string, Record<string, unknown>>
>();

export class ContentWriter {
    private readonly values: Map<string, Record<string, unknown>>;

    constructor(private readonly ctx: SeedContext) {
        let values = lastValues.get(ctx);
        if (!values) lastValues.set(ctx, (values = new Map()));
        this.values = values;
    }

    private get writer() {
        return this.ctx.get(EntryWriterService);
    }

    private actor(as = 'admin'): EventActor {
        return this.ctx.actor(as);
    }

    /** The id of an entry seeded earlier, for a relation value. */
    id(key: string): string {
        return this.ctx.entry(key).id;
    }

    /** The id of a media asset seeded earlier, for a media value. */
    asset(key: string): string {
        return this.ctx.asset(key);
    }

    async create(
        key: string,
        typeName: string,
        values: Record<string, unknown>,
        options: CreateOptions = {}
    ): Promise<string> {
        const type = this.ctx.type(typeName);
        const workspaceId = this.ctx.workspace(options.in ?? 'main').id;
        const group = options.translationOf
            ? this.ctx.entry(options.translationOf).localeGroupId
            : undefined;
        if (options.translationOf && !group) {
            throw new Error(
                `[seed] "${options.translationOf}" has no translation group`
            );
        }
        // A translation carries the group's shared values, as the editor's
        // "add a language" form does: shared fields sync on every save, so a
        // sibling created without them would clear them for the whole group.
        // Links to localized content are left out — each language resolves its
        // own row, and the source's id would be a cross-locale link.
        const sourceValues = options.translationOf
            ? (this.values.get(options.translationOf) ?? {})
            : {};
        const shared = Object.fromEntries(
            Object.entries(sourceValues).filter(([name]) => {
                const spec = type.fields[name];
                if (!spec || spec.localized) return false;
                const target = spec.relation?.to?.();
                return !target?.i18n;
            })
        );
        const all = { ...shared, ...values };
        const record = await explain('create', key, () =>
            this.writer.create(
                type,
                all,
                workspaceId,
                options.relations,
                options.locale ?? (type.i18n ? 'en' : undefined),
                group,
                this.actor(options.as)
            )
        );
        this.ctx.entries.set(key, {
            type: typeName,
            id: record.id,
            workspaceId,
            localeGroupId: record.localeGroupId
        });
        this.values.set(key, { ...all });
        return record.id;
    }

    /** Saves `changes` over the entry's last values — one new revision. */
    async edit(
        key: string,
        changes: Record<string, unknown>,
        as?: string,
        relations?: Relations
    ): Promise<void> {
        const entry = this.ctx.entry(key);
        const next = { ...this.values.get(key), ...changes };
        await explain('edit', key, () =>
            this.writer.update(
                this.ctx.type(entry.type),
                entry.id,
                next,
                entry.workspaceId,
                relations,
                this.actor(as)
            )
        );
        this.values.set(key, next);
    }

    async publish(key: string, as?: string, bypass = false): Promise<void> {
        const entry = this.ctx.entry(key);
        await explain('publish', key, () =>
            this.ctx
                .get(PublishEntryUseCase)
                .execute(
                    this.ctx.type(entry.type),
                    entry.id,
                    entry.workspaceId,
                    this.actor(as),
                    undefined,
                    bypass
                )
        );
    }

    async unpublish(key: string, as?: string): Promise<void> {
        const entry = this.ctx.entry(key);
        await this.ctx
            .get(UnpublishEntryUseCase)
            .execute(
                this.ctx.type(entry.type),
                entry.id,
                entry.workspaceId,
                this.actor(as)
            );
    }

    async trash(key: string, as?: string): Promise<void> {
        const entry = this.ctx.entry(key);
        await this.writer.remove(
            this.ctx.type(entry.type),
            entry.id,
            entry.workspaceId,
            this.actor(as)
        );
    }

    async restore(key: string, as?: string): Promise<void> {
        const entry = this.ctx.entry(key);
        await this.writer.restore(
            this.ctx.type(entry.type),
            entry.id,
            entry.workspaceId,
            this.actor(as)
        );
    }

    /** Appends a new draft equal to version `revision` — "go back to Tuesday". */
    async restoreRevision(
        key: string,
        revision: number,
        as?: string
    ): Promise<void> {
        const entry = this.ctx.entry(key);
        await this.ctx
            .get(RestoreRevisionUseCase)
            .execute(
                this.ctx.type(entry.type),
                entry.id,
                revision,
                entry.workspaceId,
                this.actor(as)
            );
    }
}

/** A short HTML body: rich text is stored as given. */
export const html = (...paragraphs: string[]): string =>
    paragraphs.map((p) => (p.startsWith('<') ? p : `<p>${p}</p>`)).join('');
