import { documentOf, typeOf } from '../../testing/fixtures';
import type { SchemaChange } from '../diff/schema-change';
import type { ChangeFacts } from './change-facts';
import { classify, isBlocked, needsMigration } from './classify';

const facts = (over: Partial<ChangeFacts> = {}): ChangeFacts => ({
    rows: () => 0,
    grantedTo: () => 0,
    referencedBy: () => [],
    ...over
});

const live = typeOf('tag', { name: { type: 'text' } });
const publishable = typeOf(
    'event',
    { title: { type: 'text' } },
    { publishable: true }
);
const after = documentOf(live, publishable);

const verdictOf = (change: SchemaChange, f = facts()) => {
    const [result] = classify([change], { after, facts: f });
    return [result.safety, result.reason, result.storage];
};

const text = { type: 'text' as const };

describe('classify — the verdict table', () => {
    it.each<[string, SchemaChange, ChangeFacts | undefined, unknown[]]>([
        [
            'a new type',
            { kind: 'type.add', type: 'event' },
            undefined,
            ['safe', 'new-type', true]
        ],
        [
            'a label or group change',
            { kind: 'type.meta', type: 'tag', keys: ['label'] },
            undefined,
            ['safe', 'code-only', false]
        ],
        [
            'a reorder',
            { kind: 'field.reorder', type: 'tag' },
            undefined,
            ['safe', 'code-only', false]
        ],
        [
            'turning the trash on',
            { kind: 'type.flag', type: 'tag', flag: 'paranoid', to: true },
            undefined,
            ['safe', 'trash-column', true]
        ],
        [
            'turning the trash off',
            { kind: 'type.flag', type: 'tag', flag: 'paranoid', to: false },
            undefined,
            ['blocked', 'flag-needs-data-migration', true]
        ],
        [
            'turning i18n on',
            { kind: 'type.flag', type: 'tag', flag: 'i18n', to: true },
            undefined,
            ['blocked', 'flag-needs-data-migration', true]
        ],
        [
            'an optional field',
            { kind: 'field.add', type: 'tag', field: 'color', spec: text },
            undefined,
            ['safe', 'nullable-column', true]
        ],
        [
            'a required field on a live type with rows',
            {
                kind: 'field.add',
                type: 'tag',
                field: 'code',
                spec: { ...text, required: true }
            },
            facts({ rows: () => 3 }),
            ['blocked', 'required-on-live-type', true]
        ],
        [
            'a required field on a live type with no rows',
            {
                kind: 'field.add',
                type: 'tag',
                field: 'code',
                spec: { ...text, required: true }
            },
            undefined,
            ['safe', 'nullable-column', true]
        ],
        [
            'a required boolean on a live type with rows (DEFAULT false)',
            {
                kind: 'field.add',
                type: 'tag',
                field: 'active',
                spec: { type: 'boolean', required: true }
            },
            facts({ rows: () => 3 }),
            ['safe', 'nullable-column', true]
        ],
        [
            'a required field on a publishable type (required-to-publish)',
            {
                kind: 'field.add',
                type: 'event',
                field: 'venue',
                spec: { ...text, required: true }
            },
            facts({ rows: () => 3 }),
            ['safe', 'nullable-column', true]
        ],
        [
            'a removed field',
            { kind: 'field.remove', type: 'tag', field: 'legacy', spec: text },
            undefined,
            ['destructive', 'drops-data', true]
        ],
        [
            'a removed, unused type',
            { kind: 'type.remove', type: 'tag' },
            undefined,
            ['destructive', 'drops-data', true]
        ],
        [
            'a removed, granted type',
            { kind: 'type.remove', type: 'tag' },
            facts({ grantedTo: () => 1 }),
            ['blocked', 'type-in-use', true]
        ],
        [
            'a removed, referenced type',
            { kind: 'type.remove', type: 'tag' },
            facts({ referencedBy: () => ['post'] }),
            ['blocked', 'type-in-use', true]
        ],
        [
            'a rename',
            { kind: 'field.rename', type: 'tag', from: 'a', to: 'b' },
            undefined,
            ['blocked', 'rename-unsupported', true]
        ],
        [
            'a retype',
            {
                kind: 'field.retype',
                type: 'tag',
                field: 'a',
                from: 'text',
                to: 'number'
            },
            undefined,
            ['blocked', 'retype-unsupported', true]
        ]
    ])('%s', (_, change, f, expected) => {
        expect(verdictOf(change, f)).toEqual(expected);
    });

    it.each<[string, string[], string, unknown[]]>([
        [
            'required on a live type',
            ['required'],
            'tag',
            ['data', 'not-null-toggle', true]
        ],
        [
            'required on a publishable type',
            ['required'],
            'event',
            ['safe', 'code-only', false]
        ],
        [
            'a tightened rule',
            ['maxLength'],
            'tag',
            ['data', 'constraint-tightened', false]
        ],
        [
            'display options only',
            ['admin'],
            'tag',
            ['safe', 'code-only', false]
        ],
        [
            'the default value',
            ['defaultValue'],
            'tag',
            ['safe', 'code-only', false]
        ]
    ])('updating %s', (_, keys, type, expected) => {
        expect(
            verdictOf({
                kind: 'field.update',
                type,
                field: 'name',
                keys,
                before: text,
                after: text
            })
        ).toEqual(expected);
    });

    it('treats a relation storage change as a data check', () => {
        const before = { type: 'relation' as const, to: 'tag' };
        expect(
            verdictOf({
                kind: 'field.update',
                type: 'tag',
                field: 'parent',
                keys: ['unique'],
                before,
                after: { ...before, unique: true }
            })
        ).toEqual(['data', 'relation-constraint', true]);
    });
});

describe('classify — ids and summaries', () => {
    it('gives each change a stable id', () => {
        const [removed] = classify(
            [
                {
                    kind: 'field.remove',
                    type: 'tag',
                    field: 'legacyCode',
                    spec: text
                }
            ],
            { after, facts: facts() }
        );
        expect(removed.id).toBe('field.remove:tag.legacyCode');
    });

    it('says whether anything blocks or needs a migration', () => {
        const results = classify(
            [
                { kind: 'type.meta', type: 'tag', keys: ['label'] },
                { kind: 'field.rename', type: 'tag', from: 'a', to: 'b' }
            ],
            { after, facts: facts() }
        );
        expect(isBlocked(results)).toBe(true);
        expect(needsMigration(results.slice(0, 1))).toBe(false);
    });
});
