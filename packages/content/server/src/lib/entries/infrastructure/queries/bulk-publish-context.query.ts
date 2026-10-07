import { BadRequestException, Injectable } from '@nestjs/common';
import { asc, inArray } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { InjectDatabase, type Database } from '@orthacms/database';
import {
    ENTRY_STATUS,
    type AnyContentType,
    type EntryStatus
} from '../../../types/content-type';
import { CONTENT_FIELD_TYPE } from '../../../types/fields';
import { WorkspaceGrantsQuery } from '../../../content-types/queries/workspace-grants.query';
import { PUBLISH_CONTEXT_MAX_LINKED } from '../../entries.constants';
import type {
    PublishContextEntry,
    PublishContextLink,
    PublishContextRecord,
    PublishContextView
} from '../../types/bulk-publish';
import { EntryWriterService } from '../persistence/entry-writer.service';
import { entryTitle } from '../persistence/entry-row';

type Row = Record<string, unknown>;

/** One outgoing link of a requested entry, before its target is loaded. */
type PendingLink = { field: string; target: AnyContentType; targetId: string };

/**
 * The **publish context** of a set of entries — what the admin's Publish
 * Manager needs before it can offer anything: each entry's title, publish
 * state and translation group, and the **unpublished records it links to**
 * through its own relation fields, one hop deep.
 *
 * Linked drafts are the reason it exists. Publishing an article whose author
 * or tags are still drafts puts a page live that points at nothing a reader
 * can see; the manager offers those drafts alongside, and the reader decides.
 * This query only reports — the publish itself is the ordinary bulk publish,
 * per type, with its own dry run.
 *
 * What counts as a linked draft is deliberately narrow, because every one is
 * an offer to publish:
 * - **owning** relations only (a single FK or a many join). An inverse field
 *   lists records that point *here*; they are not this page's dependencies.
 * - a **publishable** target type the workspace holds an **own** grant for —
 *   anything else could not be published from here (bulk publish would 404).
 * - a target row **owned by this workspace** and live (a shared source's rows
 *   are published at their source; a trashed one is not on offer).
 * - not already `published`. A Modified target counts: its live copy is not
 *   what the link will show once the edits ship, and leaving it is a choice
 *   the reader should make with the fact in front of them.
 *
 * Reads only, no locks: the answer is advisory, and the commit re-validates.
 */
@Injectable()
export class BulkPublishContextQuery {
    constructor(
        @InjectDatabase() private readonly db: Database,
        private readonly writer: EntryWriterService,
        private readonly grants: WorkspaceGrantsQuery
    ) {}

    /** The context of `ids`; 400 on a non-publishable type. */
    async context(
        type: AnyContentType,
        ids: string[],
        workspaceId: string
    ): Promise<PublishContextView> {
        if (!type.publishable) {
            throw new BadRequestException(
                `Content type "${type.name}" is not publishable.`
            );
        }
        const entries: Record<string, PublishContextEntry | null> = {};
        for (const id of ids) entries[id] = null;

        const byId = await this.writer.loadLiveByIds(type, ids, workspaceId);
        if (!byId.size) return { entries };

        const links = await this.outgoingLinks(type, byId, workspaceId);
        const targets = await this.loadTargets(links, workspaceId);

        for (const id of ids) {
            const row = byId.get(id);
            if (!row) continue;
            const linked: PublishContextLink[] = [];
            const seen = new Set<string>();
            let linkedTruncated = false;
            for (const link of links.get(id) ?? []) {
                const target = targets
                    .get(link.target.name)
                    ?.get(link.targetId);
                if (!target || target['status'] === ENTRY_STATUS.Published) {
                    continue;
                }
                // One record reached through two fields is one offer.
                const key = `${link.target.name}:${link.targetId}`;
                if (seen.has(key)) continue;
                if (linked.length >= PUBLISH_CONTEXT_MAX_LINKED) {
                    linkedTruncated = true;
                    break;
                }
                seen.add(key);
                const spec = type.fields[link.field];
                linked.push({
                    ...describe(link.target, target),
                    field: link.field,
                    fieldLabel: spec?.admin?.label ?? link.field
                });
            }
            entries[id] = { ...describe(type, row), linked, linkedTruncated };
        }
        return { entries };
    }

    /**
     * Every outgoing link of the loaded rows whose target this workspace could
     * publish, keyed by source id, in field-declaration order. One query per
     * many-relation field for the whole batch; single FKs are on the rows.
     */
    private async outgoingLinks(
        type: AnyContentType,
        byId: Map<string, Row>,
        workspaceId: string
    ): Promise<Map<string, PendingLink[]>> {
        const links = new Map<string, PendingLink[]>();
        const push = (sourceId: string, link: PendingLink) => {
            const list = links.get(sourceId) ?? [];
            list.push(link);
            links.set(sourceId, list);
        };
        const owned = await this.grants.grantedSlugs(workspaceId);
        const sourceIds = [...byId.keys()];

        for (const [field, spec] of Object.entries(type.fields)) {
            if (spec.type !== CONTENT_FIELD_TYPE.Relation || !spec.relation) {
                continue;
            }
            if (spec.relation.inverse) continue;
            const target = spec.relation.to();
            if (!target.publishable || !owned.has(target.name)) continue;

            if (spec.relation.many) {
                const joinTable = type.joinTables[field];
                const join = joinTable as unknown as Record<string, PgColumn>;
                const rows = await this.db
                    .select({
                        sourceId: join['sourceId'],
                        targetId: join['targetId']
                    })
                    .from(joinTable)
                    .where(inArray(join['sourceId'], sourceIds))
                    // The order the editor arranged them in.
                    .orderBy(asc(join['position']));
                for (const row of rows) {
                    push(row.sourceId as string, {
                        field,
                        target,
                        targetId: row.targetId as string
                    });
                }
                continue;
            }
            for (const [sourceId, row] of byId) {
                const targetId = row[field];
                if (typeof targetId === 'string') {
                    push(sourceId, { field, target, targetId });
                }
            }
        }
        return links;
    }

    /** The live, workspace-owned target rows, per target type, by id. */
    private async loadTargets(
        links: Map<string, PendingLink[]>,
        workspaceId: string
    ): Promise<Map<string, Map<string, Row>>> {
        const wanted = new Map<
            string,
            { type: AnyContentType; ids: Set<string> }
        >();
        for (const list of links.values()) {
            for (const link of list) {
                const entry = wanted.get(link.target.name) ?? {
                    type: link.target,
                    ids: new Set<string>()
                };
                entry.ids.add(link.targetId);
                wanted.set(link.target.name, entry);
            }
        }
        const loaded = new Map<string, Map<string, Row>>();
        for (const [name, { type, ids }] of wanted) {
            loaded.set(
                name,
                await this.writer.loadLiveByIds(type, [...ids], workspaceId)
            );
        }
        return loaded;
    }
}

/** The shared descriptor of one row. */
function describe(type: AnyContentType, row: Row): PublishContextRecord {
    const id = row['id'] as string;
    const title = entryTitle(type, row);
    const publishedAt = row['publishedAt'] as Date | null | undefined;
    return {
        id,
        type: type.name,
        // `entryTitle` falls back to the id; that is not a title.
        ...(title !== id ? { title } : {}),
        status: row['status'] as EntryStatus,
        publishedAt: publishedAt ? publishedAt.toISOString() : null,
        ...(type.i18n
            ? {
                  locale: row['locale'] as string,
                  localeGroupId: row['localeGroupId'] as string
              }
            : {})
    };
}
