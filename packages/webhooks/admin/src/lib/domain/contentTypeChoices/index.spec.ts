import {
    addContentTypeNames,
    contentTypeChoices,
    parseContentTypeNames
} from './index';

const CATALOGUE = [
    { name: 'article', label: 'Articles' },
    { name: 'product', label: 'Products' }
];

describe('the content-type picker options', () => {
    it('labels the registry’s types from the registry', () => {
        expect(contentTypeChoices(CATALOGUE, [])).toEqual([
            { value: 'article', label: 'Articles', known: true },
            { value: 'product', label: 'Products', known: true }
        ]);
    });

    it('keeps a selected name the build does not define', () => {
        // The case the whole module exists for: an endpoint subscribed to a
        // type that is about to be added — or a typo. Dropping it here would
        // widen the endpoint to every type on the next save.
        const choices = contentTypeChoices(CATALOGUE, ['landing_page']);
        expect(choices).toContainEqual({
            value: 'landing_page',
            label: 'landing_page',
            known: false
        });
    });

    it('does not duplicate a selected name the registry already has', () => {
        const choices = contentTypeChoices(CATALOGUE, ['article']);
        expect(choices.filter((c) => c.value === 'article')).toHaveLength(1);
    });

    it('renders nothing but the selection when the catalogue is unreachable', () => {
        // What a 403 on `/content-schema` leaves behind: an empty catalogue.
        // Free entry still has to work, and the existing filter still has to
        // show.
        expect(contentTypeChoices([], ['article'])).toEqual([
            { value: 'article', label: 'article', known: false }
        ]);
    });
});

describe('reading typed-in names', () => {
    it.each([
        ['article', ['article']],
        ['article, product', ['article', 'product']],
        ['article product', ['article', 'product']],
        ['article\nproduct', ['article', 'product']],
        ['  article ,, product  ', ['article', 'product']],
        ['', []],
        ['   ', []]
    ])('reads %j as %j', (raw, expected) => {
        expect(parseContentTypeNames(raw)).toEqual(expected);
    });

    it('leaves case alone', () => {
        // A machine name is whatever the registry says it is; lower-casing here
        // would quietly rewrite a subscription the server would have matched.
        expect(parseContentTypeNames('BlogPost')).toEqual(['BlogPost']);
    });
});

describe('adding names to a selection', () => {
    it('appends in order', () => {
        expect(addContentTypeNames(['article'], ['product'])).toEqual([
            'article',
            'product'
        ]);
    });

    it('ignores one that is already selected', () => {
        expect(addContentTypeNames(['article'], ['article'])).toEqual([
            'article'
        ]);
    });

    it('de-duplicates within one paste', () => {
        expect(addContentTypeNames([], ['article', 'article'])).toEqual([
            'article'
        ]);
    });
});
