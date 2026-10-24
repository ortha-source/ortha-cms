import { AlarmFindingsService } from './alarm-findings.service';
import type { AlarmFindingStore } from '../infrastructure/alarm-finding.store';
import type { EntryTitlesQuery } from '../infrastructure/entry-titles.query';
import type {
    AlarmFindingListView,
    AlarmFindingView
} from '../types/alarm-views';

/**
 * The findings page the alarms screen reads: the store's page, named.
 *
 * What matters is that naming decorates and never decides — the page, its
 * total and its order are the store's, untouched, and an entry with no title
 * keeps its row.
 */

const WORKSPACE = '11111111-1111-4111-8111-111111111111';

function finding(entryId: string): AlarmFindingView {
    return {
        ruleId: 'rule-1',
        ruleName: 'Author missing',
        title: 'Author is not set',
        contentType: 'article',
        entryId,
        severity: 'error',
        state: 'open',
        detail: null,
        firstSeenAt: '2026-10-20T00:00:00.000Z',
        lastSeenAt: '2026-10-20T00:00:00.000Z'
    };
}

function setup(page: AlarmFindingListView) {
    const titleCalls: unknown[] = [];
    const store = {
        list: async () => page
    } as unknown as AlarmFindingStore;
    const titles = {
        titles: async (_workspaceId: string, refs: { entryId: string }[]) => {
            titleCalls.push(refs);
            return new Map<string, string | null>([
                ['e1', 'Pricing FAQ'],
                ['e2', null]
            ]);
        }
    } as unknown as EntryTitlesQuery;
    return {
        service: new AlarmFindingsService(store, titles),
        titleCalls
    };
}

describe('AlarmFindingsService.list', () => {
    it('names every finding on the page and keeps the page as it was', async () => {
        const { service } = setup({
            items: [finding('e1'), finding('e2')],
            total: 24,
            page: 2,
            pageSize: 10
        });

        const result = await service.list(WORKSPACE, {
            page: 2,
            pageSize: 10
        });

        expect(result.total).toBe(24);
        expect(result.page).toBe(2);
        expect(
            result.items.map((item) => [item.entryId, item.entryTitle])
        ).toEqual([
            ['e1', 'Pricing FAQ'],
            ['e2', null]
        ]);
    });

    it('asks for no titles when the page is empty', async () => {
        const { service, titleCalls } = setup({
            items: [],
            total: 0,
            page: 1,
            pageSize: 10
        });

        const result = await service.list(WORKSPACE, { page: 1, pageSize: 10 });

        expect(result.items).toEqual([]);
        expect(titleCalls).toHaveLength(0);
    });
});
