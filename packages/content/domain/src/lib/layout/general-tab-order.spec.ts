import {
    generalTabRank,
    GENERAL_TAB_DEFAULT_RANK,
    orderGeneralTab
} from './general-tab-order';

describe('the General tab order', () => {
    it('ranks inputs, then choices, then large fields', () => {
        expect(
            ['text', 'number', 'money', 'date', 'datetime'].map(generalTabRank)
        ).toEqual([0, 0, 0, 0, 0]);
        expect(
            ['select', 'boolean', 'multiselect'].map(generalTabRank)
        ).toEqual([1, 1, 1]);
        expect(['richtext', 'json'].map(generalTabRank)).toEqual([2, 2]);
    });

    it('puts an unlisted type last', () => {
        expect(generalTabRank('relation')).toBe(GENERAL_TAB_DEFAULT_RANK);
        expect(generalTabRank('something-new')).toBe(GENERAL_TAB_DEFAULT_RANK);
    });

    it('keeps declaration order within a rank', () => {
        const fields = [
            { name: 'body', type: 'richtext' },
            { name: 'featured', type: 'boolean' },
            { name: 'title', type: 'text' },
            { name: 'format', type: 'select' },
            { name: 'slug', type: 'text' }
        ];
        expect(orderGeneralTab(fields).map((f) => f.name)).toEqual([
            'title',
            'slug',
            'featured',
            'format',
            'body'
        ]);
        expect(fields[0].name).toBe('body'); // the input is not mutated
    });
});
