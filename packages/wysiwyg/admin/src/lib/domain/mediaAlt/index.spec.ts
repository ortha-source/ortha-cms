import { mediaAltAttributes } from '.';

/**
 * The one rule that decides what an image announces, tested where it lives.
 *
 * It is a two-line function, and it exists because it was previously spelled
 * out at one of the two writers and not the other: `setMediaAlt` cleared the
 * alt, the node view's own save did not, and an image the author had declared
 * carries no information still announced its description to the screen-reader
 * user the mark exists to protect (see `docs/coverage/tests-that-cannot-fail.md`,
 * `wysiwyg:I-25`). The e2e case pins the popover's path through the browser;
 * this pins the rule itself, which is what both paths now call.
 *
 * The fixture that matters is the one that was missing then: a **non-empty**
 * alt beside `decorative: true`. With an empty alt going in, `{ alt, decorative }`
 * and `{ alt: decorative ? '' : alt, decorative }` are the same function.
 */
describe('mediaAltAttributes', () => {
    it('clears a written alt when the image is marked decorative [wysiwyg:I-25]', () => {
        expect(
            mediaAltAttributes({ alt: 'A ruled divider', decorative: true })
        ).toEqual({ alt: '', decorative: true });
    });

    it('keeps a written alt on an image that carries information', () => {
        expect(
            mediaAltAttributes({
                alt: 'The 2019 revenue chart',
                decorative: false
            })
        ).toEqual({ alt: 'The 2019 revenue chart', decorative: false });
    });

    it('leaves an unanswered image unanswered rather than declaring it decorative', () => {
        // The pair the "Add alt text" prompt keys off: empty *and* not
        // decorative is a defect the editor keeps pointing at, so the rule must
        // not quietly settle it by flipping either half.
        expect(mediaAltAttributes({ alt: '', decorative: false })).toEqual({
            alt: '',
            decorative: false
        });
    });

    it('records the decorative answer itself, not only the emptied alt', () => {
        // `alt=""` alone cannot be told apart from "nobody has written this
        // yet"; the attribute is what makes the answer readable back.
        expect(mediaAltAttributes({ alt: '', decorative: true })).toEqual({
            alt: '',
            decorative: true
        });
    });
});
