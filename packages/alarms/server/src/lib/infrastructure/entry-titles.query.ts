import { Injectable } from '@nestjs/common';
import {
    EntryWriterService,
    InjectContentRegistry,
    entryTitle,
    type ContentTypeRegistry
} from '@orthacms/content-server';

/** One entry to name: which collection it lives in, and its id. */
export interface EntryRef {
    contentType: string;
    entryId: string;
}

/**
 * Display titles for the entries a finding or a preview names.
 *
 * A finding carries an entry id and nothing else, and an alarms page that can
 * only say "test_article 3f0c…" is a page of ids nobody can act on. The title
 * is content's own: the first non-empty short text field (`entryTitle`), the
 * rule the bulk-publish preview and protection's review queue already label
 * rows by — so a record is called the same thing on every surface.
 *
 * **One read per content type, not one per entry.** A page of findings can mix
 * collections, so the refs are grouped by type and each group is one
 * `loadLiveByIds` — content's own workspace-scoped, trash-excluding read — and
 * this plugin never queries a `content_<name>` table itself.
 *
 * Nothing here throws for a missing piece. A type that is no longer registered,
 * an entry that has gone, a row with no title-eligible value: each is a `null`
 * title, and the caller falls back to the id. A name is a convenience on top of
 * a finding; failing to find one must never cost the finding.
 */
@Injectable()
export class EntryTitlesQuery {
    constructor(
        private readonly entries: EntryWriterService,
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry
    ) {}

    /**
     * Titles for `refs` in `workspaceId`, keyed by entry id. An entry with no
     * title (or no row) maps to `null`; every ref asked about has a key.
     */
    async titles(
        workspaceId: string,
        refs: readonly EntryRef[]
    ): Promise<Map<string, string | null>> {
        const result = new Map<string, string | null>();
        const byType = new Map<string, string[]>();
        for (const ref of refs) {
            result.set(ref.entryId, null);
            const ids = byType.get(ref.contentType) ?? [];
            if (!ids.includes(ref.entryId)) ids.push(ref.entryId);
            byType.set(ref.contentType, ids);
        }

        await Promise.all(
            [...byType].map(async ([contentType, ids]) => {
                const type = this.registry.get(contentType);
                if (!type) return;
                let rows: Map<string, Record<string, unknown>>;
                try {
                    rows = await this.entries.loadLiveByIds(
                        type,
                        ids,
                        workspaceId
                    );
                } catch {
                    // A failed title read leaves the ids standing in; it does
                    // not fail the findings page it decorates.
                    return;
                }
                for (const id of ids) {
                    const row = rows.get(id);
                    if (!row) continue;
                    const title = entryTitle(type, { ...row, id });
                    // `entryTitle` falls back to the id itself; that is the
                    // caller's fallback to draw, not a title.
                    result.set(id, title === id ? null : title);
                }
            })
        );
        return result;
    }
}
