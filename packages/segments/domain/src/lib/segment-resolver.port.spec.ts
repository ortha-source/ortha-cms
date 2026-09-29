import { headerSegmentResolver } from './segment-resolver.port';

describe('headerSegmentResolver', () => {
    const resolver = headerSegmentResolver('X-Reader-Tags');
    const tagsFor = (value: string | string[] | undefined) =>
        resolver.resolve({ headers: { 'x-reader-tags': value } });

    it('reads a comma-separated header into tags', async () => {
        await expect(tagsFor('premium, eu')).resolves.toEqual([
            'premium',
            'eu'
        ]);
    });

    it('matches the header whatever case it was configured in', async () => {
        // Node lower-cases incoming header names, so a name configured as it is
        // written in the docs would otherwise never match and every reader
        // would silently be anonymous.
        await expect(tagsFor('premium')).resolves.toEqual(['premium']);
    });

    it('joins a repeated header', async () => {
        await expect(tagsFor(['a', 'b, c'])).resolves.toEqual(['a', 'b', 'c']);
    });

    it('reads an absent or blank header as the anonymous reader', async () => {
        await expect(tagsFor(undefined)).resolves.toEqual([]);
        await expect(tagsFor('')).resolves.toEqual([]);
        await expect(tagsFor(' , ,')).resolves.toEqual([]);
    });
});
