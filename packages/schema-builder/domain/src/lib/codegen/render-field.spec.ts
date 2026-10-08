import { renderField } from './render-field';

describe('renderField — one DSL call per field type, defaults left out', () => {
    it.each([
        [
            { type: 'text', required: true, maxLength: 160 },
            'field.text({ required: true, maxLength: 160 })'
        ],
        [
            { type: 'text', pattern: "^it's$" },
            "field.text({ pattern: '^it\\'s$' })"
        ],
        [
            { type: 'richtext', structure: 'off', localized: true },
            "field.richtext({ localized: true, structure: 'off' })"
        ],
        [
            { type: 'number', integer: true, min: 0 },
            'field.number({ min: 0, integer: true })'
        ],
        [{ type: 'money', min: 0 }, 'field.money({ min: 0 })'],
        [{ type: 'boolean' }, 'field.boolean()'],
        [{ type: 'date', required: false }, 'field.date()'],
        [
            { type: 'datetime', admin: { width: 'half' } },
            "field.datetime({ admin: { width: 'half' } })"
        ],
        [{ type: 'json', admin: {} }, 'field.json()'],
        [
            { type: 'select', options: ['online', 'offline'] },
            "field.select({ options: ['online', 'offline'] })"
        ],
        [
            { type: 'multiselect', options: [] },
            'field.multiselect({ options: [] })'
        ],
        [
            { type: 'media', multiple: true, accept: { kinds: ['image'] } },
            "field.media({ multiple: true, accept: { kinds: ['image'] } })"
        ],
        [
            { type: 'select', options: ['a', 'b'], defaultValue: 'b' },
            "field.select({ options: ['a', 'b'], defaultValue: 'b' })"
        ],
        [
            { type: 'multiselect', options: ['a'], defaultValue: ['a'] },
            "field.multiselect({ options: ['a'], defaultValue: ['a'] })"
        ],
        [
            { type: 'number', required: true, max: 5, defaultValue: 0 },
            'field.number({ required: true, max: 5, defaultValue: 0 })'
        ],
        [
            { type: 'boolean', defaultValue: false },
            'field.boolean({ defaultValue: false })'
        ],
        [
            { type: 'date', defaultValue: 'today' },
            "field.date({ defaultValue: 'today' })"
        ],
        [{ type: 'media', multiple: false }, 'field.media()']
    ] as const)('%j', (spec, source) => {
        expect(renderField(spec as never)).toBe(source);
    });

    it('writes a relation target as an annotated thunk, and omits the DSL defaults', () => {
        expect(renderField({ type: 'relation', to: 'author' })).toBe(
            'field.relation({ to: (): AnyContentType => author })'
        );
        expect(
            renderField({
                type: 'relation',
                to: 'author',
                required: true,
                onDelete: 'cascade'
            })
        ).toBe(
            'field.relation({ to: (): AnyContentType => author, required: true })'
        );
        expect(
            renderField({
                type: 'relation',
                to: 'author',
                onDelete: 'restrict',
                many: false
            })
        ).toBe(
            "field.relation({ to: (): AnyContentType => author, onDelete: 'restrict' })"
        );
        expect(
            renderField({
                type: 'relation',
                to: 'tag',
                many: true,
                syncAcrossLocales: true
            })
        ).toBe('field.relation({ to: (): AnyContentType => tag, many: true })');
        expect(
            renderField({
                type: 'relation',
                to: 'tag',
                syncAcrossLocales: false
            })
        ).toBe(
            'field.relation({ to: (): AnyContentType => tag, syncAcrossLocales: false })'
        );
    });

    it('writes an inverse with relationInverse, and only to-one when asked', () => {
        expect(
            renderField({ type: 'relation', to: 'post', inverseOf: 'author' })
        ).toBe(
            "field.relationInverse({ of: (): AnyContentType => post, field: 'author' })"
        );
        expect(
            renderField({
                type: 'relation',
                to: 'seo',
                inverseOf: 'page',
                many: false,
                admin: { label: 'Page' }
            })
        ).toBe(
            "field.relationInverse({ of: (): AnyContentType => seo, field: 'page', many: false, admin: { label: 'Page' } })"
        );
    });

    it('keeps project-specific admin keys verbatim', () => {
        expect(
            renderField({
                type: 'text',
                admin: { widget: 'color', swatches: ['#fff'] }
            })
        ).toBe(
            "field.text({ admin: { widget: 'color', swatches: ['#fff'] } })"
        );
    });
});
