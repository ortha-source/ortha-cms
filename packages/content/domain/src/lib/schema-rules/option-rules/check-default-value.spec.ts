import { checkDefaultValue } from './check-default-value';

const pass = { columns: new Map<string, string>() };
const type = {
    name: 'event',
    kind: 'collection' as const,
    i18n: false,
    fields: {}
};

describe('checkDefaultValue', () => {
    it('accepts no default and one the field accepts', () => {
        expect(
            checkDefaultValue(
                type,
                'status',
                { type: 'select', required: false, options: ['a'] },
                pass
            )
        ).toEqual([]);
        expect(
            checkDefaultValue(
                type,
                'status',
                {
                    type: 'select',
                    required: false,
                    options: ['a'],
                    defaultValue: 'a'
                },
                pass
            )
        ).toEqual([]);
    });

    it('reports a default the options no longer hold', () => {
        const [found] = checkDefaultValue(
            type,
            'status',
            {
                type: 'select',
                required: false,
                options: ['a', 'b'],
                defaultValue: 'c'
            },
            pass
        );
        expect(found).toEqual({
            path: 'event.fields.status',
            code: 'field.default-value',
            message:
                'Field "event.status" has default value "c", which must be one of: a, b.'
        });
    });

    it('reports a default outside the range', () => {
        const [found] = checkDefaultValue(
            type,
            'seats',
            {
                type: 'number',
                required: false,
                validation: { min: 1 },
                defaultValue: 0
            },
            pass
        );
        expect(found.message).toBe(
            'Field "event.seats" has default value 0, which must be ≥ 1.'
        );
    });

    it('reports a default on a type that takes none', () => {
        const [found] = checkDefaultValue(
            type,
            'cover',
            { type: 'media', required: false, defaultValue: 'x' },
            pass
        );
        expect(found.message).toBe(
            'Field "event.cover" has default value "x", which cannot be used: a media field takes no default value.'
        );
    });
});
