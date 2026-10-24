import type { OutboxWriter, UnitOfWork } from '@orthacms/database';
import type {
    AnyContentType,
    ContentTypeRegistry,
    EntryMatchQuery,
    WorkspaceGrantsQuery
} from '@orthacms/content-server';
import { AlarmRulesService } from './alarm-rules.service';
import type { AlarmEvaluator } from '../infrastructure/alarm-evaluator.service';
import type {
    AlarmRuleRecord,
    AlarmRuleRepository
} from '../infrastructure/alarm-rule.repository';
import type { EntryTitlesQuery } from '../infrastructure/entry-titles.query';
import type { AlarmRuleView, AlarmScanResultView } from '../types/alarm-views';
import { PREVIEW_SAMPLE_SIZE } from '../alarms.constants';

/**
 * The rule lifecycle's two answers the redesigned editor reads: what a save
 * did (`update` → `scan`), and what a draft would flag (`preview` → `sample`).
 *
 * Collaborators are recording stubs. The properties under test are which
 * calls happen — whether a write rescans, and with what — and a database would
 * only show their effects.
 */

const WORKSPACE = '11111111-1111-4111-8111-111111111111';
const RULE_ID = '22222222-2222-4222-8222-222222222222';
const ARTICLE = { name: 'article', fields: {} } as unknown as AnyContentType;

const FILTER = { and: [{ field: 'title', op: 'is_empty' }] };

function record(overrides: Partial<AlarmRuleRecord> = {}): AlarmRuleRecord {
    return {
        id: RULE_ID,
        workspaceId: WORKSPACE,
        contentType: 'article',
        name: 'No SEO description',
        findingTitle: 'Add a meta description',
        severity: 'warn',
        filter: FILTER,
        enabled: true,
        brokenReason: null,
        ...overrides
    };
}

function view(rule: AlarmRuleRecord): AlarmRuleView {
    return {
        id: rule.id,
        contentType: rule.contentType,
        name: rule.name,
        findingTitle: rule.findingTitle,
        description: null,
        severity: rule.severity,
        filter: rule.filter,
        enabled: rule.enabled,
        brokenReason: null,
        lastScanAt: null,
        createdBy: 'user-1',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
        openCount: 38
    };
}

const SCAN: AlarmScanResultView = {
    ruleId: RULE_ID,
    scanned: 842,
    opened: 3,
    resolved: 2,
    open: 38
};

function setup(existing: AlarmRuleRecord) {
    let stored = existing;
    const rescans: AlarmRuleRecord[] = [];
    const titleCalls: unknown[] = [];

    const rules = {
        findOrFail: async () => stored,
        update: async (
            _workspaceId: string,
            _id: string,
            patch: Partial<AlarmRuleRecord>
        ) => {
            stored = { ...stored, ...patch };
            return stored;
        },
        listWithCounts: async () => [view(stored)]
    } as unknown as AlarmRuleRepository;
    const evaluator = {
        rescan: async (rule: AlarmRuleRecord) => {
            rescans.push(rule);
            return SCAN;
        }
    } as unknown as AlarmEvaluator;
    const matches = {
        assertParses: () => undefined,
        countMatching: async () => 38,
        countAll: async () => 842,
        matchingIds: async (
            _type: unknown,
            _filter: unknown,
            _workspaceId: string,
            options: { limit?: number }
        ) => ['e1', 'e2', 'e3', 'e4'].slice(0, options.limit)
    } as unknown as EntryMatchQuery;
    const grants = {
        grantedSlugs: async () => new Set(['article'])
    } as unknown as WorkspaceGrantsQuery;
    const registry = {
        get: (name: string) => (name === 'article' ? ARTICLE : undefined)
    } as unknown as ContentTypeRegistry;
    const titles = {
        titles: async (
            _workspaceId: string,
            refs: { entryId: string }[]
        ): Promise<Map<string, string | null>> => {
            titleCalls.push(refs);
            return new Map(
                refs.map((ref) => [
                    ref.entryId,
                    ref.entryId === 'e3' ? null : `Title of ${ref.entryId}`
                ])
            );
        }
    } as unknown as EntryTitlesQuery;
    const uow = {
        run: <T>(work: () => Promise<T>) => work()
    } as unknown as UnitOfWork;
    const outbox = {
        append: async () => undefined
    } as unknown as OutboxWriter;

    const service = new AlarmRulesService(
        uow,
        outbox,
        rules,
        evaluator,
        matches,
        grants,
        registry,
        titles
    );
    return { service, rescans, titleCalls };
}

describe('AlarmRulesService.update', () => {
    it('rescans a changed filter and returns what the scan did [alarms:I-07]', async () => {
        const { service, rescans } = setup(record());

        const result = await service.update(WORKSPACE, RULE_ID, {
            filter: { and: [{ field: 'title', op: 'is_not_empty' }] }
        });

        expect(rescans).toHaveLength(1);
        // The editor's toast reads this: "checked 842, 38 flagged, 2 cleared".
        expect(result.scan).toEqual(SCAN);
        expect(result.openCount).toBe(38);
    });

    it('rescans a rule switched back on, so its findings are current', async () => {
        const { service, rescans } = setup(record({ enabled: false }));

        const result = await service.update(WORKSPACE, RULE_ID, {
            enabled: true
        });

        expect(rescans).toHaveLength(1);
        expect(result.enabled).toBe(true);
        expect(result.scan).toEqual(SCAN);
    });

    it('does not rescan a rename, and says so with scan: null', async () => {
        const { service, rescans } = setup(record());

        const result = await service.update(WORKSPACE, RULE_ID, {
            name: 'Missing meta description'
        });

        expect(rescans).toHaveLength(0);
        expect(result.scan).toBeNull();
        expect(result.name).toBe('Missing meta description');
    });

    it('does not rescan a rule being switched off, even with a new filter', async () => {
        const { service, rescans } = setup(record());

        const result = await service.update(WORKSPACE, RULE_ID, {
            enabled: false,
            filter: FILTER
        });

        expect(rescans).toHaveLength(0);
        expect(result.scan).toBeNull();
    });
});

describe('AlarmRulesService.preview', () => {
    it('lists a sample of the matching entries by title', async () => {
        const { service, titleCalls } = setup(record());

        const preview = await service.preview(WORKSPACE, {
            contentType: 'article',
            filter: FILTER
        });

        expect(preview.matched).toBe(38);
        expect(preview.total).toBe(842);
        expect(preview.sampleIds).toHaveLength(PREVIEW_SAMPLE_SIZE);
        // Same entries, same order; an untitled one is null, not its id.
        expect(preview.sample).toEqual([
            { id: 'e1', title: 'Title of e1' },
            { id: 'e2', title: 'Title of e2' },
            { id: 'e3', title: null },
            { id: 'e4', title: 'Title of e4' }
        ]);
        // Named against the previewed type, in one batch.
        expect(titleCalls).toEqual([
            ['e1', 'e2', 'e3', 'e4'].map((entryId) => ({
                contentType: 'article',
                entryId
            }))
        ]);
    });

    it('refuses a type the workspace was not granted [alarms:I-16]', async () => {
        const { service } = setup(record());

        await expect(
            service.preview(WORKSPACE, { contentType: 'invoice', filter: {} })
        ).rejects.toThrow(/invoice/);
    });
});
