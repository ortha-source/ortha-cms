import {
    defaultValueProblem,
    isRelativeDefault,
    takesDefaultValue
} from './default-value';

const spec = (type: string, extra: object = {}) => ({
    type,
    required: false,
    ...extra
});

describe('takesDefaultValue', () => {
    it('is offered on scalars and choices, never on a relation or media', () => {
        for (const type of [
            'text',
            'number',
            'money',
            'boolean',
            'date',
            'datetime',
            'select',
            'multiselect'
        ])
            expect(takesDefaultValue(type)).toBe(true);
        for (const type of ['richtext', 'json', 'relation', 'media'])
            expect(takesDefaultValue(type)).toBe(false);
    });
});

describe('defaultValueProblem', () => {
    it('accepts a value the field would accept', () => {
        expect(defaultValueProblem(spec('text'), 'Untitled')).toBeUndefined();
        expect(defaultValueProblem(spec('boolean'), false)).toBeUndefined();
        expect(
            defaultValueProblem(spec('number', { validation: { min: 0 } }), 3)
        ).toBeUndefined();
        expect(
            defaultValueProblem(spec('select', { options: ['a', 'b'] }), 'b')
        ).toBeUndefined();
        expect(
            defaultValueProblem(spec('multiselect', { options: ['a', 'b'] }), [
                'a'
            ])
        ).toBeUndefined();
        expect(defaultValueProblem(spec('date'), '2026-01-31')).toBeUndefined();
    });

    it('accepts the relative defaults only on their own type', () => {
        expect(defaultValueProblem(spec('date'), 'today')).toBeUndefined();
        expect(defaultValueProblem(spec('datetime'), 'now')).toBeUndefined();
        expect(isRelativeDefault('date', 'now')).toBe(false);
        expect(defaultValueProblem(spec('date'), 'now')).toBe(
            'must be an ISO date (YYYY-MM-DD)'
        );
    });

    it('refuses a value outside the rules, through the entry validator', () => {
        expect(
            defaultValueProblem(spec('select', { options: ['a', 'b'] }), 'c')
        ).toBe('must be one of: a, b');
        expect(
            defaultValueProblem(spec('number', { validation: { max: 5 } }), 7)
        ).toBe('must be ≤ 5');
        expect(defaultValueProblem(spec('number'), '7')).toBe(
            'must be a number'
        );
    });

    it('refuses an empty default and a type that takes none', () => {
        expect(defaultValueProblem(spec('text'), '')).toMatch(/^is empty/);
        expect(defaultValueProblem(spec('multiselect'), [])).toMatch(
            /^is empty/
        );
        expect(
            defaultValueProblem(
                spec('relation'),
                '7f0c5b9e-0000-4000-8000-000000000000'
            )
        ).toBe('cannot be used: a relation field takes no default value');
    });
});
