import { checkSinglePath } from './check-single-path';

const single = (path?: string) => ({
    name: 'home',
    kind: 'single' as const,
    path,
    i18n: false,
    fields: {}
});

describe('checkSinglePath', () => {
    it('ignores collections, which have no path', () => {
        expect(
            checkSinglePath({
                name: 'post',
                kind: 'collection',
                i18n: false,
                fields: {}
            })
        ).toEqual([]);
    });

    it('accepts a path starting with a slash', () => {
        expect(checkSinglePath(single('/about'))).toEqual([]);
    });

    it.each([['about'], [undefined]])('rejects %j', (path) => {
        const [found] = checkSinglePath(single(path));
        expect(found.code).toBe('type.single-path');
        expect(found.message).toBe(
            `Single "home" path must start with "/" (got "${path ?? ''}").`
        );
    });
});
