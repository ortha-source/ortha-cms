import { Editor } from '@tiptap/core';
import { editorExtensions } from '../editorExtensions';
// The column commands are declared by the extension's own module augmentation,
// which importing `editorExtensions` alone elides.
import '../extensions/columns';
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

/**
 * The preview's other promise: it is not merely *safe*, it is the **same**
 * markup the editor surface renders. That is what makes a collapsed field an
 * honest picture of what pressing it will open, and what lets one stylesheet
 * scope dress both.
 *
 * It holds structurally today — one schema, serialized by one `DOMSerializer` —
 * and that is exactly why it is worth an assertion: nothing about the code says
 * so out loud, and a preview that grew a tidying pass (dropping an attribute a
 * consumer "doesn't need", unwrapping a figure, adding a class) would still
 * render, still be safe, and quietly stop matching.
 */
describe('the preview beside the editor surface [wysiwyg:I-34]', () => {
    /** A document with one of everything the schema can hold. */
    function written(): Editor {
        const editor = new Editor({
            element: document.createElement('div'),
            extensions: editorExtensions(''),
            content: [
                '<h2>Heading</h2>',
                '<p>Text with <strong>bold</strong>, <em>italic</em> and a ',
                '<span lang="fr">French</span> run.</p>',
                '<ul><li><p>One</p></li><li><p>Two</p></li></ul>',
                '<blockquote><p>Quoted</p></blockquote>',
                '<pre><code>code()</code></pre>',
                '<img src="/api/media/assets/a1/raw" alt="A chart" ',
                'width="320" data-align="center">',
                '<video src="https://cdn.example.com/clip.mp4" width="200">',
                '</video>',
                '<table><tbody><tr><th><p>H</p></th><td><p>C</p></td></tr>',
                '</tbody></table>'
            ].join('')
        });
        editor.commands.setColumns(2);
        return editor;
    }

    it('serializes one document to the same markup', () => {
        const editor = written();
        try {
            const surface = editor.getHTML();

            // Not "contains the same tags" — byte for byte. Anything softer
            // would pass for a preview that had started rewriting the document
            // on its way to the screen.
            expect(renderRichText(editor.getJSON())).toBe(surface);
            // The fixture is only as good as what it holds: a document that had
            // silently lost its media or its table would make the comparison
            // above true and meaningless.
            expect(surface).toContain('data-align="center"');
            expect(surface).toContain('<video');
            expect(surface).toContain('<th');
            expect(surface).toContain('data-columns');
        } finally {
            editor.destroy();
        }
    });

    it('differs in exactly one place, and says why', () => {
        // Links are flattened to spans: a preview sits under a full-bleed
        // "edit" button, and a live `<a>` inside it would be a tab stop that
        // navigates the admin away from the record. Asserting the one
        // difference is what keeps the test above from being read as "these
        // two are the same function".
        const editor = new Editor({
            element: document.createElement('div'),
            extensions: editorExtensions(''),
            content: '<p><a href="https://example.com">A link</a></p>'
        });
        try {
            expect(editor.getHTML()).toContain('href="https://example.com"');
            expect(editor.getHTML()).toContain('<a ');

            const preview = renderRichText(editor.getJSON());
            expect(preview).not.toContain('<a ');
            expect(preview).toContain('<span data-link=""');
            expect(preview).toContain('A link');
        } finally {
            editor.destroy();
        }
    });
});
