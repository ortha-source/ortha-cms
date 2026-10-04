import { fieldFacts } from './index';

describe('fieldFacts', () => {
    it('says nothing about a plain optional field', () => {
        expect(fieldFacts({ type: 'text' })).toEqual([]);
    });

    it('lists the flags in a fixed order', () => {
        expect(
            fieldFacts({
                type: 'text',
                required: true,
                localized: true,
                admin: { hidden: true }
            })
        ).toEqual([
            { kind: 'required' },
            { kind: 'localized' },
            { kind: 'hidden' }
        ]);
    });

    it('names a relation target, to-one by default', () => {
        expect(fieldFacts({ type: 'relation', to: 'author' })).toEqual([
            { kind: 'target', to: 'author', many: false }
        ]);
        expect(fieldFacts({ type: 'relation', to: 'tag', many: true })).toEqual(
            [{ kind: 'target', to: 'tag', many: true }]
        );
    });

    it('reads an inverse as to-many by default, naming the field it mirrors', () => {
        expect(
            fieldFacts({ type: 'relation', to: 'post', inverseOf: 'author' })
        ).toEqual([
            { kind: 'target', to: 'post', many: true, inverseOf: 'author' }
        ]);
    });

    it('counts choice options and marks multiple media', () => {
        expect(
            fieldFacts({ type: 'multiselect', options: ['a', 'b', 'c'] })
        ).toEqual([{ kind: 'options', count: 3 }]);
        expect(fieldFacts({ type: 'media', multiple: true })).toEqual([
            { kind: 'multiple' }
        ]);
        expect(fieldFacts({ type: 'media' })).toEqual([]);
    });
});
