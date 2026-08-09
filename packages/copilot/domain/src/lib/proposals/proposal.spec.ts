import { isProposalDraft } from './proposal';

const valid = {
    kind: 'content.entry.update',
    target: { typeName: 'article', entryId: 'e1' },
    patch: { values: { title: 'New' } },
    summary: 'Fix the headline'
};

describe('isProposalDraft', () => {
    it('accepts a well-formed draft', () => {
        expect(isProposalDraft(valid)).toBe(true);
    });

    it('accepts one carrying a diff', () => {
        expect(
            isProposalDraft({
                ...valid,
                changes: [{ field: 'title', before: 'Old', after: 'New' }]
            })
        ).toBe(true);
    });

    // The guard exists because `effect: 'propose'` is a promise a binder makes
    // about its return value, and a binder that breaks it would otherwise write
    // a malformed row into an append-only table. Each of these is a shape a
    // plausible bug produces.
    it.each([
        ['null', null],
        ['a string', 'done'],
        ['an ordinary tool result', { items: [], total: 0 }],
        ['a draft with no kind', { ...valid, kind: undefined }],
        ['a draft with an empty kind', { ...valid, kind: '' }],
        ['a draft with no summary', { ...valid, summary: undefined }],
        ['a draft with no target', { ...valid, target: undefined }],
        ['a draft with no patch', { ...valid, patch: undefined }],
        ['a draft whose patch is a string', { ...valid, patch: 'values' }]
    ])('rejects %s', (_label, value) => {
        expect(isProposalDraft(value)).toBe(false);
    });
});
