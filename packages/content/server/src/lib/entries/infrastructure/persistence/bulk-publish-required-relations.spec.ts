import type { Database } from '@orthacms/database';
import { collection } from '../../../collection/define';
import { field } from '../../../fields';
import type { AnyContentType } from '../../../types/content-type';
import type { ValidationIssue } from '../../../validation/services/entry-validation.service';
import { BULK_VERDICT } from '../../types/bulk-publish';
import { computeBulkPublishVerdicts, draftIds } from './bulk-publish-verdicts';
import { EntryWriterService } from './entry-writer.service';
import { RelationLinkService } from './relation-link.service';

/**
 * Bulk publish applies the single publish's **whole** gate: the value rules
 * and the required link-managed relations (an owning many-to-many, or the
 * inverse of one) that never travel in the `values` bag. It used to apply only
 * the first half, so a batch could publish an entry the single publish refused.
 */

const tag = collection('bulk_req_tag', { fields: { name: field.text() } });

const post: AnyContentType = collection('bulk_req_post', {
    publishable: true,
    fields: {
        title: field.text({ required: true }),
        // Owning many-to-many, required: counted.
        tags: field.relation({ to: () => tag, many: true, required: true }),
        // Required owning single: an FK in `values`, never counted here.
        lead: field.relation({ to: () => tag, required: true }),
        // Optional owning many: never counted.
        extra: field.relation({ to: () => tag, many: true }),
        // Inverse of a many-to-many, required: counted.
        backlinks: field.relationInverse({
            of: (): AnyContentType => citer,
            field: 'cites',
            required: true
        })
    }
}) as AnyContentType;

/** Owns the many-to-many `post.backlinks` reads from the other end. */
const citer: AnyContentType = collection('bulk_req_citer', {
    fields: {
        cites: field.relation({ to: (): AnyContentType => post, many: true })
    }
}) as AnyContentType;

const IDS = ['e1', 'e2', 'e3'];

/** A relation service whose link counts come from a fixed table. */
function fakeRelations(counts: Record<string, Record<string, number>>) {
    return {
        countJoinLinksByOwner: jest.fn(
            async (
                _exec: unknown,
                _type: AnyContentType,
                ids: readonly string[],
                name: string
            ) =>
                new Map(
                    ids
                        .filter((id) => (counts[name]?.[id] ?? 0) > 0)
                        .map((id) => [id, counts[name][id]] as const)
                )
        ),
        countLinks: jest.fn(
            async (
                _exec: unknown,
                _type: AnyContentType,
                row: Record<string, unknown>,
                name: string
            ) => counts[name]?.[row['id'] as string] ?? 0
        )
    };
}

function writerWith(relations: ReturnType<typeof fakeRelations>) {
    const validation = { waivedRequired: jest.fn(async () => new Set()) };
    const writer = new EntryWriterService(
        {} as never,
        {} as never,
        {} as never,
        validation as never,
        relations as never,
        {} as never,
        {} as never
    );
    return { writer, validation };
}

describe('EntryWriterService.requiredRelationIssuesBulk [content:I-51]', () => {
    const counts = {
        tags: { e1: 2, e3: 1 },
        backlinks: { e1: 1 }
    };

    it('reports exactly what the single-entry count reports, per id', async () => {
        const relations = fakeRelations(counts);
        const { writer } = writerWith(relations);
        const bulk = await writer.requiredRelationIssuesBulk(
            {} as never,
            post,
            IDS,
            'ws',
            new Set()
        );
        for (const id of IDS) {
            const single = await writer.requiredRelationIssues(
                {} as never,
                post,
                { id },
                'ws',
                new Set()
            );
            expect(bulk.get(id) ?? []).toEqual(single);
        }
        expect(bulk.has('e1')).toBe(false);
        expect(bulk.get('e2')).toEqual([
            { field: 'tags', message: 'is required' },
            { field: 'backlinks', message: 'is required' }
        ]);
        expect(bulk.get('e3')).toEqual([
            { field: 'backlinks', message: 'is required' }
        ]);
    });

    it('issues one grouped count per counted field, not one per entry', async () => {
        const relations = fakeRelations(counts);
        const { writer } = writerWith(relations);
        await writer.requiredRelationIssuesBulk(
            {} as never,
            post,
            IDS,
            'ws',
            new Set()
        );
        expect(
            relations.countJoinLinksByOwner.mock.calls.map((call) => [
                call[2],
                call[3]
            ])
        ).toEqual([
            [IDS, 'tags'],
            [IDS, 'backlinks']
        ]);
        expect(relations.countLinks).not.toHaveBeenCalled();
    });

    it('never counts a waived relation [content:I-50]', async () => {
        const relations = fakeRelations({});
        const { writer } = writerWith(relations);
        const bulk = await writer.requiredRelationIssuesBulk(
            {} as never,
            post,
            IDS,
            'ws',
            new Set(['tags', 'backlinks'])
        );
        expect(bulk.size).toBe(0);
        expect(relations.countJoinLinksByOwner).not.toHaveBeenCalled();
    });

    it('reads the waiver itself when the caller has not', async () => {
        const relations = fakeRelations({});
        const { writer, validation } = writerWith(relations);
        validation.waivedRequired.mockResolvedValueOnce(new Set(['tags']));
        const bulk = await writer.requiredRelationIssuesBulk(
            {} as never,
            post,
            ['e1'],
            'ws'
        );
        expect(validation.waivedRequired).toHaveBeenCalledWith(post, 'ws', {});
        expect(bulk.get('e1')).toEqual([
            { field: 'backlinks', message: 'is required' }
        ]);
    });

    it('reads nothing for an empty batch', async () => {
        const relations = fakeRelations({});
        const { writer, validation } = writerWith(relations);
        expect(
            (
                await writer.requiredRelationIssuesBulk(
                    {} as never,
                    post,
                    [],
                    'ws'
                )
            ).size
        ).toBe(0);
        expect(validation.waivedRequired).not.toHaveBeenCalled();
    });
});

describe('RelationLinkService.countJoinLinksByOwner', () => {
    it('answers a whole batch with one grouped query', async () => {
        const statements: string[] = [];
        const chain = {
            select: () => (statements.push('select'), chain),
            from: () => chain,
            where: () => chain,
            groupBy: async () => [
                { owner: 'e1', total: 3 },
                { owner: 'e3', total: '1' }
            ]
        };
        const service = new RelationLinkService({} as Database);
        const totals = await service.countJoinLinksByOwner(
            chain as never,
            post,
            IDS,
            'tags',
            post.fields['tags']
        );
        expect(statements).toEqual(['select']);
        expect([...totals]).toEqual([
            ['e1', 3],
            ['e3', 1]
        ]);
    });

    it('touches nothing for a relation that is not join-backed', async () => {
        const forbidden = new Proxy(
            {},
            {
                get() {
                    throw new Error('queried');
                }
            }
        );
        const service = new RelationLinkService({} as Database);
        await expect(
            service.countJoinLinksByOwner(
                forbidden as never,
                post,
                IDS,
                'lead',
                post.fields['lead']
            )
        ).resolves.toEqual(new Map());
    });
});

describe('computeBulkPublishVerdicts — required link-managed relations [content:I-51]', () => {
    const row = (id: string, status = 'draft') => ({
        id,
        status,
        title: `Post ${id}`,
        leadId: 'lead-1',
        createdAt: new Date(),
        updatedAt: new Date()
    });
    const byId = new Map([
        ['e1', row('e1')],
        ['e2', row('e2')],
        ['e3', row('e3', 'published')]
    ]);
    const missingTags: ValidationIssue[] = [
        { field: 'tags', message: 'is required' }
    ];

    it('blocks a draft missing a required link and publishes the rest', () => {
        const items = computeBulkPublishVerdicts(
            post,
            ['e1', 'e2'],
            byId,
            () => ({ valid: true, issues: [] }),
            new Set(),
            new Map([['e2', missingTags]])
        );
        expect(items.map((item) => item.verdict)).toEqual([
            BULK_VERDICT.Publishable,
            BULK_VERDICT.Blocked
        ]);
        expect(items[1].issues).toEqual(missingTags);
        expect(items[1].checks.find((c) => c.field === 'tags')).toEqual(
            expect.objectContaining({ ok: false, message: 'is required' })
        );
    });

    it('reports the value issues alone when the values fail, like the single publish', () => {
        const valueIssues = [{ field: 'title', message: 'is required' }];
        const [item] = computeBulkPublishVerdicts(
            post,
            ['e2'],
            byId,
            () => ({ valid: false, issues: valueIssues }),
            new Set(),
            new Map([['e2', missingTags]])
        );
        expect(item.verdict).toBe(BULK_VERDICT.Blocked);
        expect(item.issues).toEqual(valueIssues);
    });

    it('counts only the rows a publish would change', () => {
        expect(draftIds(byId)).toEqual(['e1', 'e2']);
    });
});
