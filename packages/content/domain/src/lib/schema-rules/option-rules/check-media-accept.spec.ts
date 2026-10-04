import { checkMediaAccept } from './check-media-accept';

const pass = { columns: new Map<string, string>() };
const type = {
    name: 'event',
    kind: 'collection' as const,
    i18n: false,
    fields: {}
};

describe('checkMediaAccept', () => {
    it('accepts known kinds and no restriction', () => {
        expect(
            checkMediaAccept(
                type,
                'cover',
                { type: 'media', required: false },
                pass
            )
        ).toEqual([]);
        expect(
            checkMediaAccept(
                type,
                'cover',
                {
                    type: 'media',
                    required: false,
                    accept: { kinds: ['image', 'video'] }
                },
                pass
            )
        ).toEqual([]);
    });

    it('reports every unknown kind', () => {
        const found = checkMediaAccept(
            type,
            'cover',
            {
                type: 'media',
                required: false,
                accept: { kinds: ['image', 'photo', 'pdf'] }
            },
            pass
        );
        expect(found.map((i) => i.message)).toEqual([
            'Field "event.cover" accepts media kind "photo": expected one of image, video, audio, document, archive.',
            'Field "event.cover" accepts media kind "pdf": expected one of image, video, audio, document, archive.'
        ]);
    });
});
