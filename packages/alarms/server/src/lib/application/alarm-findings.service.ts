import { Injectable } from '@nestjs/common';
import {
    AlarmFindingStore,
    type ListFindingsFilter
} from '../infrastructure/alarm-finding.store';
import { EntryTitlesQuery } from '../infrastructure/entry-titles.query';
import type { AlarmFindingListView } from '../types/alarm-views';

/**
 * The findings page as the alarms screen reads it: the store's page, with each
 * entry named.
 *
 * The store stays the one place a finding is read from — the copilot tool and
 * the by-entry batch use it directly and need no titles — and naming is a
 * second, bounded read on top of a page that is already at most
 * `MAX_PAGE_SIZE` long: one query per content type on it, never one per row.
 */
@Injectable()
export class AlarmFindingsService {
    constructor(
        private readonly findings: AlarmFindingStore,
        private readonly titles: EntryTitlesQuery
    ) {}

    /** One page of the workspace's findings, each carrying `entryTitle`. */
    async list(
        workspaceId: string,
        filter: ListFindingsFilter
    ): Promise<AlarmFindingListView> {
        const page = await this.findings.list(workspaceId, filter);
        if (page.items.length === 0) return page;
        const titles = await this.titles.titles(workspaceId, page.items);
        return {
            ...page,
            items: page.items.map((item) => ({
                ...item,
                entryTitle: titles.get(item.entryId) ?? null
            }))
        };
    }
}
