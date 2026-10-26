import {
    CONTENT_FIELD_TYPE,
    type AnyContentType,
    type ContentTypeRegistry,
    type EntryWriterService
} from '@orthacms/content-server';
import { EntryTitlesQuery } from './entry-titles.query';

/**
 * Naming the entries a findings page lists.
 *
 * Driven against a recording `loadLiveByIds`, because the properties that
 * matter are about the reads: one per content type (never one per row), always
 * scoped to the caller's workspace, and never fatal — a name is a convenience
 * on top of a finding, so failing to find one must not cost the finding.
 */

const WORKSPACE = '11111111-1111-4111-8111-111111111111';

const ARTICLE = {
    name: 'article',
    fields: {
        body: { type: CONTENT_FIELD_TYPE.RichText },
        title: { type: CONTENT_FIELD_TYPE.Text }
    }
} as unknown as AnyContentType;

const PLAN = {
    name: 'plan',
    fields: { name: { type: CONTENT_FIELD_TYPE.Text } }
} as unknown as AnyContentType;

const TYPES: Record<string, AnyContentType> = { article: ARTICLE, plan: PLAN };

type LoadCall = { type: string; ids: string[]; workspaceId: string };

function setup(
    rows: Record<string, Record<string, unknown>>,
    { failFor }: { failFor?: string } = {}
) {
    const calls: LoadCall[] = [];
    const entries = {
        loadLiveByIds: async (
            type: AnyContentType,
            ids: string[],
            workspaceId: string
        ) => {
            calls.push({ type: type.name, ids, workspaceId });
            if (type.name === failFor) throw new Error('db down');
            return new Map(
                ids
                    .filter((id) => rows[id])
                    .map((id) => [id, { id, ...rows[id] }])
            );
        }
    } as unknown as EntryWriterService;
    const registry = {
        get: (name: string) => TYPES[name]
    } as unknown as ContentTypeRegistry;
    return { query: new EntryTitlesQuery(entries, registry), calls };
}

describe('EntryTitlesQuery', () => {
    it('names each entry by its first short text field', async () => {
        const { query } = setup({
            a1: { body: '<p>long</p>', title: 'Spring launch — what changed' },
            p1: { name: 'Enterprise' }
        });

        const titles = await query.titles(WORKSPACE, [
            { contentType: 'article', entryId: 'a1' },
            { contentType: 'plan', entryId: 'p1' }
        ]);

        expect(titles.get('a1')).toBe('Spring launch — what changed');
        expect(titles.get('p1')).toBe('Enterprise');
    });

    it('reads once per content type, scoped to the workspace', async () => {
        const { query, calls } = setup({
            a1: { title: 'One' },
            a2: { title: 'Two' },
            p1: { name: 'Plan' }
        });

        await query.titles(WORKSPACE, [
            { contentType: 'article', entryId: 'a1' },
            { contentType: 'article', entryId: 'a2' },
            { contentType: 'plan', entryId: 'p1' },
            // A repeat is asked about once, not twice.
            { contentType: 'article', entryId: 'a1' }
        ]);

        expect(calls).toEqual([
            { type: 'article', ids: ['a1', 'a2'], workspaceId: WORKSPACE },
            { type: 'plan', ids: ['p1'], workspaceId: WORKSPACE }
        ]);
    });

    it('answers null — not the id — when there is no title to show', async () => {
        const { query } = setup({ a1: { title: '   ' } });

        const titles = await query.titles(WORKSPACE, [
            // Blank title: content's helper falls back to the id, which is the
            // caller's fallback to draw, not a title.
            { contentType: 'article', entryId: 'a1' },
            // Gone (trashed or purged).
            { contentType: 'article', entryId: 'a-gone' },
            // A type no longer registered.
            { contentType: 'retired', entryId: 'r1' }
        ]);

        expect([...titles]).toEqual([
            ['a1', null],
            ['a-gone', null],
            ['r1', null]
        ]);
    });

    it('never fails the page it decorates', async () => {
        const { query } = setup(
            { a1: { title: 'Kept' }, p1: { name: 'Lost' } },
            { failFor: 'plan' }
        );

        const titles = await query.titles(WORKSPACE, [
            { contentType: 'article', entryId: 'a1' },
            { contentType: 'plan', entryId: 'p1' }
        ]);

        expect(titles.get('a1')).toBe('Kept');
        expect(titles.get('p1')).toBeNull();
    });
});
