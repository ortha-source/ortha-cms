import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { transformPastedHTML } from '.';

/** The package's `src` root, from this file. */
const SRC = join(__dirname, '..', '..', '..');

/** Every `.ts`/`.tsx` under `src`, specs excluded. */
function sources(dir: string = SRC): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return sources(path);
        if (!/\.tsx?$/.test(entry.name)) return [];
        if (/\.(spec|test)\.tsx?$/.test(entry.name)) return [];
        return [path];
    });
}

/**
 * Reads the transformed HTML back as a DOM rather than comparing strings: the
 * serializer normalizes whitespace, quoting and the trailing semicolon inside a
 * `style`, and asserting on that shape would break on a jsdom upgrade while
 * saying nothing about the rule.
 */
function stylesOf(html: string): CSSStyleDeclaration[] {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    return [...parsed.body.querySelectorAll<HTMLElement>('*')].map(
        (element) => element.style
    );
}

/** The one element in `html`, as a DOM node. */
function only(html: string): HTMLElement {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const element = parsed.body.firstElementChild;
    if (!element) throw new Error(`no element in ${html}`);
    return element as HTMLElement;
}

/**
 * The clipboard's typography, dropped on the way in.
 *
 * Measured against what Word and Google Docs actually put on the clipboard
 * (`ORT-164`): Docs stamps `color: rgb(0, 0, 0); font-size: 11pt` on
 * essentially every run it exports, so a body pasted from it silently overrode
 * the consuming site's own typography for that entry — including, on a dark
 * theme, into unreadable.
 */
describe('transformPastedHTML', () => {
    it('drops colour, size and highlight the author never chose [wysiwyg:I-32]', () => {
        const out = transformPastedHTML(
            '<p><span style="color: rgb(0, 0, 0); font-size: 11pt; background-color: rgb(255, 255, 0);">Pasted</span></p>'
        );

        for (const declarations of stylesOf(out)) {
            expect(declarations.getPropertyValue('color')).toBe('');
            expect(declarations.getPropertyValue('font-size')).toBe('');
            expect(declarations.getPropertyValue('background-color')).toBe('');
        }
        // The words themselves are not the clipboard's typography.
        expect(only(out).textContent).toBe('Pasted');
    });

    it('strips every element it finds, not just the outermost', () => {
        // Word nests: a coloured paragraph around a differently-sized run. A
        // pass that only looked at `body`'s children would leave the run.
        const out = transformPastedHTML(
            '<p style="color: rgb(192, 0, 0);">Loud <span style="font-size: 14pt;">and louder</span></p>'
        );

        for (const declarations of stylesOf(out)) {
            expect(declarations.getPropertyValue('color')).toBe('');
            expect(declarations.getPropertyValue('font-size')).toBe('');
        }
    });

    it('keeps the styling that is not typography', () => {
        // The rule is a list of three properties, not "drop `style`". A paste
        // that lost its alignment and its emphasis would be a different bug.
        const out = transformPastedHTML(
            '<p style="text-align: center; color: rgb(0, 0, 0); font-weight: 700;">Centred</p>'
        );

        const style = only(out).style;
        expect(style.getPropertyValue('text-align')).toBe('center');
        expect(style.getPropertyValue('font-weight')).toBe('700');
        expect(style.getPropertyValue('color')).toBe('');
    });

    it('leaves no empty style attribute behind', () => {
        // An element whose only styling was the stripped set would otherwise
        // serialize `style=""` into the stored body — noise in published
        // content, and a `style` attribute that survives every later round trip.
        const out = transformPastedHTML(
            '<span style="color: rgb(0, 0, 0);">Plain</span>'
        );

        expect(only(out).hasAttribute('style')).toBe(false);
        expect(out).not.toContain('style');
    });

    it('leaves markup that carries no style untouched', () => {
        const out = transformPastedHTML(
            '<p>A <strong>bold</strong> <a href="https://example.com/x">link</a></p>'
        );

        expect(only(out).innerHTML).toBe(
            'A <strong>bold</strong> <a href="https://example.com/x">link</a>'
        );
    });

    // covers: wysiwyg:I-32
    it('is reached from the paste hook and from nowhere else', () => {
        // The invariant's second half — "a colour applied by a toolbar command
        // does not [lose it]" — is a statement about *where* this runs. The
        // colour commands write through TipTap; nothing in this package may
        // route an edit through the clipboard transform, or author-chosen
        // colour would be stripped along with the pasted kind and the swatch
        // menu would silently do nothing.
        const callers = sources()
            .filter((file) => !file.startsWith(join(__dirname)))
            .filter((file) =>
                /\btransformPastedHTML\b/.test(readFileSync(file, 'utf8'))
            )
            .map((file) => file.slice(SRC.length + 1));

        expect(callers).toEqual([
            join(
                'lib',
                'presentation',
                'components',
                'WysiwygEditorPanel',
                'index.tsx'
            )
        ]);

        // …and in that one file it is an `editorProps` key, which is the
        // clipboard seam, rather than something called from `onUpdate`.
        const panel = readFileSync(join(SRC, callers[0]), 'utf8');
        expect(panel).toMatch(/editorProps:\s*\{/);
        expect(panel).toMatch(/^\s+transformPastedHTML\s*$/m);
    });
});
