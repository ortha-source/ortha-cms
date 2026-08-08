import { Injectable } from '@nestjs/common';
import type { AnyContentType } from '../../types/content-type';
import { toRecord } from '../../entries/infrastructure/persistence/entry-row';
import { EntryWriterService } from '../../entries/infrastructure/persistence/entry-writer.service';
import { PublishEntryUseCase } from '../../entries/application/use-cases/publish-entry.use-case';
import { UnpublishEntryUseCase } from '../../entries/application/use-cases/unpublish-entry.use-case';
import type { PublicSaveEntryDto } from '../http/dto/public-save-entry.dto';
import type { PublicEntry } from '../types/public-entry';
import { PublicEntriesQuery, type EntryLocator } from './public-entries.query';

/**
 * The write side of the public content API.
 *
 * **A thin edge over the admin's write pipeline, deliberately** — the opposite
 * call from the read side, and for the opposite reason. The read stated its own
 * WHERE because `EntriesService`'s knobs select rows a token must never see, so
 * reaching through it would have made the visibility rule an argument about what
 * was *not* passed. A write has no such hazard and a great deal more to get
 * right: `EntryWriterService` already owns field validation, relation-delta
 * application, media-target checks, revision numbering serialized by a per-entry
 * advisory lock, the transactional outbox, and the i18n extension's sibling sync
 * (which demotes rewritten published translations and re-validates them). A
 * second implementation of any of that is how you get duplicate version numbers
 * and translations that quietly drift. So this class adds exactly three things
 * the writer does not know about — the locator, the grant gate (in the
 * controller), and the public wire shape — and delegates the rest.
 *
 * **Responses are re-read through the public projection** rather than mapped
 * from the writer's `EntryRecord`. It costs one SELECT per write and buys the
 * guarantee that what a write returns is byte-identical in shape to what a read
 * returns — including the reference fields the public `values` omits, which a
 * hand-written mapper would have to remember to strip every time the field
 * vocabulary grows.
 *
 * **No `OriginGuard`.** The admin's write controllers carry it because they are
 * cookie-authenticated and therefore CSRF-able. A bearer token is not sent
 * ambiently by a browser, so there is nothing to forge here — and requiring an
 * `Origin` header would break every non-browser client, which is all of them.
 */
@Injectable()
export class PublicEntryWritesService {
    constructor(
        private readonly writer: EntryWriterService,
        private readonly entries: PublicEntriesQuery,
        private readonly publishEntry: PublishEntryUseCase,
        private readonly unpublishEntry: UnpublishEntryUseCase
    ) {}

    /**
     * Create an entry. It lands as a **draft** on publishable types — the same
     * as the editor's "new record", and the reason publish is its own call: a
     * create that went live immediately would have no reviewable state.
     *
     * With `localeGroupId` the row joins an existing translation group instead
     * of starting one, which is how a new locale of an existing record is
     * written.
     */
    async create(
        type: AnyContentType,
        body: PublicSaveEntryDto,
        workspaceId: string,
        grantedTypes: ReadonlySet<string>
    ): Promise<PublicEntry> {
        const record = await this.writer.create(
            type,
            body.values,
            workspaceId,
            body.relations,
            body.locale,
            body.localeGroupId,
            // Revisions record a *user* id, and a token is not a user. Writing
            // the token id into that column would make the history resolve it to
            // a nonexistent person; null is the honest answer for "not a user".
            // Attributing a token's writes is a real gap — it wants its own
            // column, not a misused one.
            null
        );
        return this.readBack(type, record.id, workspaceId, grantedTypes, body);
    }

    /**
     * Update an entry's values and apply its relation deltas. On a publishable
     * type this moves a published row back to `draft` while its published
     * version stays live — the admin's **Modified** state — so an edit never
     * silently changes what the world is reading.
     *
     * **A genuine partial update**, and this is a deliberate divergence from the
     * admin's `PATCH`, which replaces the whole values bag because the editor
     * always submits the full document. An API client does not: it sends the two
     * fields it changed. Under replace semantics that silently nulls everything
     * else — and since `required` only bites at publish time, the damage is
     * invisible until a later publish fails on fields the caller never touched.
     * A method named PATCH that destroys unsent data is a data-loss footgun, so
     * the stored values are merged under the submitted ones here.
     *
     * Merge is **by key presence**, so nulling a field explicitly still works:
     * `{"excerpt": null}` clears it, while omitting `excerpt` leaves it alone.
     *
     * `locale` here is the **addressing** locale — the query string's, which
     * picks the row out of a translation group. It is deliberately not
     * `body.locale`: that field is create-only (it stamps a new row's locale),
     * and reading it here would let a body that omits it silently retarget a
     * group write at the default-locale row. Which is exactly what it did, until
     * a live check caught a German update rewriting the English article.
     */
    async update(
        type: AnyContentType,
        locator: EntryLocator,
        body: PublicSaveEntryDto,
        workspaceId: string,
        grantedTypes: ReadonlySet<string>,
        locale?: string
    ): Promise<PublicEntry> {
        const row = await this.entries.resolveWritableRow(
            type,
            locator,
            workspaceId,
            locale
        );
        const id = row['id'] as string;
        await this.writer.update(
            type,
            id,
            // `toRecord` yields the stored column-backed values — scalars, media
            // ids, and owning single-relation FKs. Join-backed relations have no
            // column and are absent from it, which is correct: those move only
            // through `relations` deltas, and a delta left unsent changes
            // nothing by construction.
            { ...toRecord(type, row).values, ...body.values },
            workspaceId,
            body.relations,
            null
        );
        return this.readBack(type, id, workspaceId, grantedTypes, { locale });
    }

    /** Take an entry live. 422 when the stored draft no longer validates. */
    async publish(
        type: AnyContentType,
        locator: EntryLocator,
        workspaceId: string,
        grantedTypes: ReadonlySet<string>,
        locale?: string
    ): Promise<PublicEntry> {
        const row = await this.entries.resolveWritableRow(
            type,
            locator,
            workspaceId,
            locale
        );
        const id = row['id'] as string;
        await this.publishEntry.execute(type, id, workspaceId);
        return this.readBack(type, id, workspaceId, grantedTypes, { locale });
    }

    /** Take an entry back off the air, reverting it to a draft. */
    async unpublish(
        type: AnyContentType,
        locator: EntryLocator,
        workspaceId: string,
        grantedTypes: ReadonlySet<string>,
        locale?: string
    ): Promise<PublicEntry> {
        const row = await this.entries.resolveWritableRow(
            type,
            locator,
            workspaceId,
            locale
        );
        const id = row['id'] as string;
        await this.unpublishEntry.execute(type, id, workspaceId);
        return this.readBack(type, id, workspaceId, grantedTypes, { locale });
    }

    /**
     * Remove an entry — soft delete on a `paranoid` type (recoverable from the
     * admin's trash), a hard delete otherwise. Either way it leaves the public
     * API immediately.
     *
     * Only **this** row: a translation is deleted on its own, so removing the
     * German article leaves the English one live. Deleting a whole group means
     * deleting each locale.
     */
    async remove(
        type: AnyContentType,
        locator: EntryLocator,
        workspaceId: string,
        locale?: string
    ): Promise<void> {
        const row = await this.entries.resolveWritableRow(
            type,
            locator,
            workspaceId,
            locale
        );
        await this.writer.remove(type, row['id'] as string, workspaceId);
    }

    /**
     * Re-read a just-written row through the public projection.
     *
     * `status: 'any'` because the row is usually a draft — the published-only
     * default would 404 the thing that was just created. The locale is carried
     * through so a sibling translation resolves to itself rather than to the
     * default-locale row of its group.
     */
    private readBack(
        type: AnyContentType,
        id: string,
        workspaceId: string,
        grantedTypes: ReadonlySet<string>,
        source: { locale?: string }
    ): Promise<PublicEntry> {
        return this.entries.getOne(
            type,
            { id },
            workspaceId,
            { locale: source.locale, status: 'any' },
            grantedTypes
        );
    }
}
