import { checkType } from './check-type';
import type { RuleField, RuleType } from './rule-type';

const text = (over: Partial<RuleField> = {}): RuleField => ({
    type: 'text',
    required: false,
    ...over
});
const type = (over: Partial<RuleType>): RuleType => ({
    name: 'post',
    kind: 'collection',
    i18n: false,
    fields: { title: text() },
    ...over
});

describe("checkType — the DSL's rules, in the DSL's order", () => {
    it('accepts a valid type', () => {
        expect(checkType(type({}))).toEqual([]);
    });

    it('reports the type name before anything about fields', () => {
        const codes = checkType(type({ name: 'Post', fields: {} })).map(
            (i) => i.code
        );
        expect(codes).toEqual(['type.name', 'type.no-fields']);
    });

    it('walks fields in declaration order: every rule for one field before the next field', () => {
        const codes = checkType(
            type({
                fields: {
                    status: text({ localized: true }),
                    title: text({ localized: true })
                }
            })
        ).map((i) => `${i.path}:${i.code}`);
        expect(codes).toEqual([
            'post.fields.status:field.localized-without-i18n',
            'post.fields.status:field.reserved-column',
            'post.fields.title:field.localized-without-i18n'
        ]);
    });

    it('checks widths after every field rule, then groups', () => {
        const codes = checkType(
            type({
                groups: { seo: { label: 'SEO' } },
                fields: { a: text({ width: 'wide' }), status: text() }
            })
        ).map((i) => i.code);
        expect(codes).toEqual([
            'field.reserved-column',
            'field.width',
            'group.empty'
        ]);
    });

    it('does not run option rules — the DSL field builders throw on those first', () => {
        expect(
            checkType(type({ fields: { slug: text({ pattern: '(' }) } }))
        ).toEqual([]);
    });
});
