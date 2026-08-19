import { isWellFormedLanguageTag } from './language-tag';

describe('isWellFormedLanguageTag', () => {
    it.each([
        'en',
        'EN',
        'fr',
        'en-GB',
        'zh-Hans-CN',
        'de-CH-1901',
        'es-419',
        'sr-Latn-RS',
        'x-klingon',
        'en-US-x-private'
    ])('accepts %s', (tag) => {
        expect(isWellFormedLanguageTag(tag)).toBe(true);
    });

    it('accepts a 4-8 letter primary subtag, which BCP-47 reserves', () => {
        // Well-formedness, not validity: `english` is not a registered
        // language, but it is the shape a registered one would take, and
        // deciding otherwise needs the IANA registry.
        expect(isWellFormedLanguageTag('english')).toBe(true);
    });

    it.each([
        'en_US', // a POSIX locale — ignored outright by a screen reader
        '',
        '   ',
        'e',
        '123',
        'en--GB',
        'en-'
    ])('rejects %j', (tag) => {
        expect(isWellFormedLanguageTag(tag)).toBe(false);
    });
});
