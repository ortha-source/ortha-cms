import { checkLang } from './check-lang';

const pass = { columns: new Map<string, string>() };
const type = {
    name: 'film',
    kind: 'collection' as const,
    i18n: false,
    fields: {}
};

describe('checkLang', () => {
    it.each([undefined, 'en', 'en-GB', 'zh-Hans'])('accepts %j', (lang) => {
        expect(
            checkLang(
                type,
                'originalTitle',
                { type: 'text', required: false, lang },
                pass
            )
        ).toEqual([]);
    });

    it.each(['en_US', 'not a tag'])('rejects %j', (lang) => {
        const [found] = checkLang(
            type,
            'originalTitle',
            { type: 'text', required: false, lang },
            pass
        );
        expect(found.code).toBe('field.lang');
        expect(found.path).toBe('film.fields.originalTitle');
    });
});
