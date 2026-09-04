import { renderRichText } from '.';

/** The rendered output, as a DOM to query rather than a string to match. */
function rendered(value: unknown): Document {
    return new DOMParser().parseFromString(renderRichText(value), 'text/html');
}

/**
 * The schema round trip, exercised on the input it exists for: a legacy body
 * that is still an HTML string, parsed out of an inert `DOMParser` document.
 *
 * That path is not only the preview's — it is the same `parseHTML` the editor
 * runs when it opens such a body, so what it refuses here is what never reaches
 * the stored document either.
 */
describe('renderRichText', () => {
    describe('media it refuses to import', () => {
        it.each([
            ['javascript:alert(1)', 'a script URL'],
            ['//evil.example.com/a.png', 'a protocol-relative URL'],
            ['data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', 'a data URL']
        ])(
            'drops an <img> with %s outright rather than blanking its src [wysiwyg:I-22]',
            (src) => {
                const document = rendered(
                    `<p>Before</p><img src="${src}"><p>After</p>`
                );

                // Not "an <img> with src=''" — that is a broken-image icon in
                // the middle of the body, which reads as data loss to whoever
                // opens the record next.
                expect(document.querySelectorAll('img')).toHaveLength(0);
                // The surrounding text is untouched: the refusal is the image,
                // not the paragraph it sat between.
                expect(
                    [...document.querySelectorAll('p')].map(
                        (node) => node.textContent
                    )
                ).toEqual(['Before', 'After']);
            }
        );

        it('imports the same markup when the src is admissible', () => {
            // The other side of the pair: without it, a parse that dropped
            // every image would pass every case above.
            const document = rendered(
                '<p>Before</p><img src="/api/media/assets/a1/raw" alt="A chart"><p>After</p>'
            );

            const image = document.querySelector('img');
            expect(image?.getAttribute('src')).toBe('/api/media/assets/a1/raw');
            expect(image?.getAttribute('alt')).toBe('A chart');
        });
    });

    describe('the size it keeps', () => {
        it('never stores a height [wysiwyg:I-23]', () => {
            // A height is what goes wrong when someone swaps the asset: the
            // browser keeps the ratio from the intrinsic size, and a stored one
            // outlives the picture it was measured from.
            const image = rendered(
                '<img src="/a.png" width="320" height="500">'
            ).querySelector('img');

            expect(image?.getAttribute('width')).toBe('320');
            expect(image?.hasAttribute('height')).toBe(false);
        });

        it('reads a width below the floor as no width at all [wysiwyg:I-23]', () => {
            // Not clamped up to 64: the author never chose the clamped number,
            // and an image silently resized on open is worse than one that
            // keeps its natural size.
            const image = rendered(
                '<img src="/a.png" width="20">'
            ).querySelector('img');

            expect(image?.hasAttribute('width')).toBe(false);
        });

        it('reads unusable width markup as no width', () => {
            const image = rendered(
                '<img src="/a.png" width="wide">'
            ).querySelector('img');

            expect(image?.hasAttribute('width')).toBe(false);
        });
    });
});
