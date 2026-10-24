import { effectiveTags, parseReaderTags, testReader } from './readerTest';

describe('effectiveTags', () => {
    it('is the tags when there are any', () => {
        expect(effectiveTags(['acme', 'acme-legacy'], 'acme_corp')).toEqual([
            'acme',
            'acme-legacy'
        ]);
    });

    it('falls back to the key — an audience with no tags answers to it', () => {
        expect(effectiveTags([], 'acme_corp')).toEqual(['acme_corp']);
    });

    it('is nothing while there is neither', () => {
        expect(effectiveTags([], '  ')).toEqual([]);
    });
});

describe('parseReaderTags', () => {
    it('reads a comma-separated list, as the header resolver does', () => {
        expect(parseReaderTags(' acme , plan-pro,,')).toEqual([
            'acme',
            'plan-pro'
        ]);
    });
});

describe('testReader', () => {
    it('puts a reader carrying any one of the tags in the audience', () => {
        expect(testReader(['acme', 'acme-legacy'], ['acme-legacy'])).toEqual({
            inAudience: true,
            nearMiss: null
        });
    });

    it('leaves a reader carrying none of them out', () => {
        expect(testReader(['acme'], ['globex'])).toEqual({
            inAudience: false,
            nearMiss: null
        });
    });

    it('matches exactly, and names the near miss a capital letter makes', () => {
        expect(testReader(['acme'], ['Acme'])).toEqual({
            inAudience: false,
            nearMiss: 'Acme'
        });
    });

    it('leaves the anonymous reader out', () => {
        expect(testReader(['acme'], []).inAudience).toBe(false);
    });
});
