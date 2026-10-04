import { TYPES } from '../../../testing/types';
import { toDocument } from './to-document';

describe('toDocument', () => {
    it('is version 1 and keeps registration order', async () => {
        const document = await toDocument(TYPES, async () => 'code');
        expect(document.version).toBe(1);
        expect(document.types.map((type) => type.name)).toEqual([
            'sb_author',
            'sb_post',
            'sb_home'
        ]);
    });

    it('asks for each type its own origin', async () => {
        const document = await toDocument(TYPES, async (type) =>
            type.name === 'sb_post' ? 'builder' : 'code'
        );
        expect(document.types.map((type) => type.origin)).toEqual([
            'code',
            'builder',
            'code'
        ]);
    });
});
