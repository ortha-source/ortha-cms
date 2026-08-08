import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { and, eq, inArray, isNull, type AnyColumn } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import { ENTRY_STATUS, type AnyContentType } from '../../types/content-type';
import { CONTENT_FIELD_TYPE, type AnyFieldSpec } from '../../types/fields';
import {
    InjectMediaAssetResolver,
    type MediaAssetResolver
} from '../../extension/media-asset-resolver';
import { RelationLinkService } from '../../entries/infrastructure/persistence/relation-link.service';
import { DEFAULT_EXPANSION_LIMIT } from '../http/dto/public-list-entries-query.dto';
import type {
    PublicMediaFieldView,
    PublicMediaRef,
    PublicRelationFieldView
} from '../types/public-expansion';
import type { PublicEntry } from '../types/public-entry';
import { toPublicEntry } from './public-entry-row';

/** A generated content row seen as a bag of values by property name. */
type Row = Record<string, unknown>;

/** A generated content table seen as a bag of columns by property name. */
type ContentTable = Record<string, AnyColumn>;

/**
 * Upper bound on how many fields one request may expand, per kind. The cost of
 * a preview scales with the number of **fields**, not rows (each relation field
 * is one or two queries spanning the whole page), so this is the knob that
 * actually bounds a request — the admin caps only the raw string length, which
 * on a public endpoint would leave a type with a dozen relations open to a
 * request asking for all of them.
 */
export const MAX_EXPANDED_FIELDS = 10;

/**
 * Resolves the public API's opt-in **relation** and **media** expansions for a
 * page of entries.
 *
 * Both are batched across the whole page — one bounded set of queries per
 * *field*, never one per row. Relations delegate to
 * `RelationLinkService.previewForEntries` (windowed `row_number()` for the cap,
 * `count(*) over` for the total, batched title resolution). Media deliberately
 * does **not** reuse `MediaRefsQuery.forValues`: that method takes one entry's
 * values, so calling it per row would be exactly the N+1 the relation preview
 * was built to avoid. Instead every media id on the page is collected and
 * resolved in a single batched lookup.
 */
@Injectable()
export class PublicExpansionQuery {
    constructor(
        @InjectDatabase() private readonly db: Database,
        private readonly relationLinks: RelationLinkService,
        @Optional()
        @InjectMediaAssetResolver()
        private readonly media?: MediaAssetResolver
    ) {}

    /**
     * Validate a `?relationFields=` list: every name must be a relation field
     * on the type, and its target must be a content type the workspace was
     * granted. An ungranted target is a **400**, matching how `?filter=` treats
     * a traversal into one — a public caller should not be able to expand into
     * content the workspace does not expose, and saying so beats silently
     * returning an empty field.
     */
    parseRelationFields(
        type: AnyContentType,
        raw: string | undefined,
        granted: ReadonlySet<string>
    ): string[] {
        if (!raw?.trim()) {
            // No list given: expand everything expandable. An ungranted target
            // is skipped rather than refused — the caller didn't name it, so
            // there is nothing to correct them about, and this matches what the
            // `/relations` sibling route returns.
            return this.allFieldsOfKind(
                type,
                'relationFields',
                (spec) =>
                    spec.type === CONTENT_FIELD_TYPE.Relation &&
                    !!spec.relation &&
                    granted.has(spec.relation.to().name)
            );
        }
        return this.parseFields(type, raw, 'relationFields', (name, spec) => {
            if (spec.type !== CONTENT_FIELD_TYPE.Relation || !spec.relation) {
                throw new BadRequestException(
                    `relationFields: "${name}" is not a relation field on "${type.name}".`
                );
            }
            const target = spec.relation.to();
            if (!granted.has(target.name)) {
                throw new BadRequestException(
                    `relationFields: "${name}" cannot be expanded — this workspace has no access to "${target.name}".`
                );
            }
        });
    }

    /** Validate a `?mediaFields=` list: every name must be a media field. */
    parseMediaFields(type: AnyContentType, raw: string | undefined): string[] {
        if (!raw?.trim()) {
            return this.allFieldsOfKind(
                type,
                'mediaFields',
                (spec) => spec.type === CONTENT_FIELD_TYPE.Media
            );
        }
        return this.parseFields(type, raw, 'mediaFields', (name, spec) => {
            if (spec.type !== CONTENT_FIELD_TYPE.Media) {
                throw new BadRequestException(
                    `mediaFields: "${name}" is not a media field on "${type.name}".`
                );
            }
        });
    }

    /**
     * One capped page of links per requested relation field, for every row on
     * the page, keyed by entry id.
     *
     * `publishedOnly` is the public difference: a draft target is neither shown
     * nor counted, so `total` is the number of links a caller can actually
     * reach.
     */
    async relationsForRows(
        type: AnyContentType,
        fields: string[],
        rows: Row[],
        workspaceId: string,
        limit = DEFAULT_EXPANSION_LIMIT
    ): Promise<Map<string, Record<string, PublicRelationFieldView>>> {
        const out = new Map<string, Record<string, PublicRelationFieldView>>();
        if (!fields.length || !rows.length) {
            return out;
        }
        const previews = await this.relationLinks.previewForEntries(
            type,
            fields,
            rows,
            workspaceId,
            limit,
            { publishedOnly: true }
        );
        // The preview yields ordered link ids; hydrate them into full entries
        // with one batched read per distinct TARGET TYPE, so a page costs a
        // query per type rather than per link.
        const entriesById = await this.linkedEntriesById(
            type,
            fields,
            previews,
            workspaceId
        );
        for (const [entryId, byField] of previews) {
            const view: Record<string, PublicRelationFieldView> = {};
            for (const [field, value] of Object.entries(byField)) {
                const linked = entriesById.get(field);
                view[field] = {
                    // Preserve the preview's link order, and drop any id the
                    // hydration didn't return (it named a target the caller
                    // can't see — already excluded from `total` upstream).
                    items: value.items
                        .map((ref) => linked?.get(ref.id))
                        .filter((entry): entry is PublicEntry => !!entry),
                    total: value.total
                };
            }
            out.set(entryId, view);
        }
        return out;
    }

    /**
     * Hydrate already-read link views (the `/relations` sibling routes' output
     * from `readAll` / `readField`) into the same full-entry shape the list
     * preview returns, so both surfaces speak one contract.
     */
    async hydrateRelationViews(
        type: AnyContentType,
        views: Record<string, { items: { id: string }[]; total: number }>,
        workspaceId: string
    ): Promise<Record<string, PublicRelationFieldView>> {
        const fields = Object.keys(views);
        const linked = await this.linkedEntriesById(
            type,
            fields,
            new Map([['one', views]]),
            workspaceId
        );
        const out: Record<string, PublicRelationFieldView> = {};
        for (const [field, view] of Object.entries(views)) {
            const byId = linked.get(field);
            out[field] = {
                items: view.items
                    .map((ref) => byId?.get(ref.id))
                    .filter((entry): entry is PublicEntry => !!entry),
                total: view.total
            };
        }
        return out;
    }

    /**
     * Load every linked entry named by a preview, keyed by field and then by
     * id. One `IN (…)` read per relation field's target type, projected through
     * the same {@link toPublicEntry} the entry routes use — so a linked record
     * has exactly the shape a consumer already handles.
     *
     * Linked entries are returned **unexpanded**: nothing here recurses, which
     * is what bounds a request to one level of the graph.
     */
    private async linkedEntriesById(
        type: AnyContentType,
        fields: string[],
        previews: Map<string, Record<string, { items: { id: string }[] }>>,
        workspaceId: string
    ): Promise<Map<string, Map<string, PublicEntry>>> {
        const idsByField = new Map<string, Set<string>>();
        for (const byField of previews.values()) {
            for (const [field, value] of Object.entries(byField)) {
                let ids = idsByField.get(field);
                if (!ids) {
                    ids = new Set<string>();
                    idsByField.set(field, ids);
                }
                for (const ref of value.items) ids.add(ref.id);
            }
        }

        const out = new Map<string, Map<string, PublicEntry>>();
        await Promise.all(
            fields.map(async (field) => {
                const ids = idsByField.get(field);
                const target = type.fields[field]?.relation?.to();
                if (!target || !ids?.size) return;
                const cols = target.table as unknown as ContentTable;
                const rows = (await this.db
                    .select()
                    .from(target.table)
                    .where(
                        and(
                            inArray(cols['id'], [...ids]),
                            eq(cols['workspaceId'], workspaceId),
                            target.publishable
                                ? eq(cols['status'], ENTRY_STATUS.Published)
                                : undefined,
                            target.paranoid
                                ? isNull(cols['deletedAt'])
                                : undefined
                        )
                    )) as Row[];
                out.set(
                    field,
                    new Map(
                        rows.map((row) => [
                            row['id'] as string,
                            toPublicEntry(target, row)
                        ])
                    )
                );
            })
        );
        return out;
    }

    /**
     * The assets of each requested media field, for every row on the page,
     * keyed by entry id. One batched resolver lookup for the whole page.
     *
     * A no-op when no media plugin is registered (nothing binds the resolver),
     * exactly like the admin's media read — content boots without media.
     */
    async mediaForRows(
        type: AnyContentType,
        fields: string[],
        rows: Row[],
        workspaceId: string,
        limit = DEFAULT_EXPANSION_LIMIT
    ): Promise<Map<string, Record<string, PublicMediaFieldView>>> {
        const out = new Map<string, Record<string, PublicMediaFieldView>>();
        if (!this.media || !fields.length || !rows.length) {
            return out;
        }

        // Collect every id on the page first, so the resolver is hit once.
        const idsByRowField = new Map<string, Map<string, string[]>>();
        const all = new Set<string>();
        for (const row of rows) {
            const entryId = row['id'];
            if (typeof entryId !== 'string') continue;
            const byField = new Map<string, string[]>();
            for (const field of fields) {
                const ids = mediaIdsOf(row[field]);
                if (!ids.length) continue;
                byField.set(field, ids);
                for (const id of ids) all.add(id);
            }
            idsByRowField.set(entryId, byField);
        }
        if (!all.size) {
            return out;
        }

        const resolved = await this.media.resolve([...all], workspaceId);
        for (const [entryId, byField] of idsByRowField) {
            const view: Record<string, PublicMediaFieldView> = {};
            for (const [field, ids] of byField) {
                // An id the resolver didn't return names an asset that is gone
                // or lives in another workspace. The admin keeps it as a
                // `missing` placeholder to preserve ordering in an editor; a
                // public read has no such need and simply omits it, so every
                // ref it returns is a real asset.
                const present = ids
                    .map((id) => resolved.get(id))
                    .filter((asset): asset is NonNullable<typeof asset> =>
                        Boolean(asset)
                    );
                // `total` counts every asset actually attached, before the
                // limit — so a lowered limit is visible as `items.length <
                // total` rather than silently passing off a slice as the whole.
                const items = present.slice(0, limit).map(
                    (asset): PublicMediaRef => ({
                        id: asset.id,
                        name: asset.name,
                        url: asset.url,
                        ...(asset.thumbUrl ? { thumbUrl: asset.thumbUrl } : {}),
                        ...(asset.previewUrl
                            ? { previewUrl: asset.previewUrl }
                            : {}),
                        kind: asset.kind,
                        mimeType: asset.mimeType,
                        alt: asset.alt
                    })
                );
                view[field] = { items, total: present.length };
            }
            out.set(entryId, view);
        }
        return out;
    }

    /**
     * Every field of one kind — what `?relations=preview` / `?media=preview`
     * expand when the caller names no fields.
     *
     * A type with more expandable fields than the cap is a **400** telling the
     * caller to name the ones they want, rather than a silently truncated
     * response: quietly dropping fields would read as "this entry has no
     * links" and be near-impossible to notice.
     */
    private allFieldsOfKind(
        type: AnyContentType,
        param: string,
        matches: (spec: AnyFieldSpec) => boolean
    ): string[] {
        const names = Object.entries(type.fields)
            .filter(([, spec]) => matches(spec))
            .map(([name]) => name);
        if (names.length > MAX_EXPANDED_FIELDS) {
            throw new BadRequestException(
                `${param}: "${type.name}" has ${names.length} expandable fields, more than the ${MAX_EXPANDED_FIELDS} a single request may expand — name the ones you need with \`${param}\`.`
            );
        }
        return names;
    }

    /** Shared parse: split, trim, de-duplicate, bound, then per-kind checks. */
    private parseFields(
        type: AnyContentType,
        raw: string | undefined,
        param: string,
        check: (name: string, spec: AnyFieldSpec) => void
    ): string[] {
        if (!raw) return [];
        const names = [
            ...new Set(
                raw
                    .split(',')
                    .map((name) => name.trim())
                    .filter(Boolean)
            )
        ];
        if (names.length > MAX_EXPANDED_FIELDS) {
            throw new BadRequestException(
                `${param}: at most ${MAX_EXPANDED_FIELDS} fields may be expanded per request.`
            );
        }
        for (const name of names) {
            const spec = type.fields[name];
            if (!spec) {
                throw new BadRequestException(
                    `${param}: unknown field "${name}" on "${type.name}".`
                );
            }
            check(name, spec);
        }
        return names;
    }
}

/** The asset ids stored in a media field — one id, or an ordered list. */
function mediaIdsOf(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.filter(
            (id): id is string => typeof id === 'string' && !!id
        );
    }
    return typeof value === 'string' && value ? [value] : [];
}
