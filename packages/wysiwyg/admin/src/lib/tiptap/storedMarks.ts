import { Mark, mergeAttributes } from '@tiptap/core';
import { isHexColor, toHexColor } from '@ortha-cms/wysiwyg-core';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        inlineMarks: {
            /** A palette name, a `#hex`, or `null` to clear. */
            setTextColor: (value: string | null) => ReturnType;
            /** The same, behind the glyphs. */
            setHighlight: (value: string | null) => ReturnType;
            /** `sans` · `serif` · `mono`, or `null`. */
            setFontRole: (value: string | null) => ReturnType;
            /** `small` · `large` · `huge`, or `null`. */
            setTextSize: (value: string | null) => ReturnType;
        };
    }
}

/**
 * Whether a value names a palette entry rather than spelling a colour out.
 * A name is what a delivery surface can map onto its own palette; a hex is the
 * escape hatch for a brand colour that has to be exact.
 */
const isName = (value: string) => !value.startsWith('#');

/**
 * Text colour — `<span data-color="blue">`, or `<span style="color: #hex">`.
 *
 * Deliberately **not** TipTap's `Color` (which rides on `TextStyle` and always
 * writes an inline `color`). A named palette entry is the better default: it
 * resolves against whatever surface renders the document, in light mode and
 * dark, where a frozen hex is one designer's decision baked into content. The
 * hex is kept as the exception, and the sanitizer accepts exactly those two
 * shapes — anything else in `style` is dropped on the way out.
 */
export const TextColor = Mark.create({
    name: 'textColor',

    addAttributes() {
        return {
            value: {
                default: null,
                parseHTML: (element) => {
                    const name = element.getAttribute('data-color');
                    if (name) return name;
                    const hex = toHexColor(element.style.color ?? '');
                    return hex;
                },
                renderHTML: (attributes) => {
                    const value = attributes['value'];
                    if (typeof value !== 'string' || value === '') return {};
                    return isName(value)
                        ? { 'data-color': value }
                        : { style: `color: ${value}` };
                }
            }
        };
    },

    parseHTML() {
        return [
            { tag: 'span[data-color]' },
            {
                tag: 'span[style*="color"]',
                // A `<span style="background-color: …">` is a highlight, not a
                // colour, and `style*="color"` matches both spellings.
                getAttrs: (element) =>
                    isHexColor(
                        toHexColor(
                            (element as HTMLElement).style.color ?? ''
                        ) ?? ''
                    ) && null
            }
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes), 0];
    },

    addCommands() {
        return {
            setTextColor:
                (value) =>
                ({ commands }) =>
                    value === null
                        ? commands.unsetMark(this.name)
                        : commands.setMark(this.name, { value })
        };
    }
});

/**
 * Highlight — `<mark data-highlight="yellow">`, or an inline
 * `background-color`.
 *
 * `<mark>` rather than a styled span because it already *means* "marked for
 * reference": a plain-text export, a reader mode, or a stylesheet that has
 * never heard of `data-highlight` all keep that meaning.
 */
export const TextHighlight = Mark.create({
    name: 'textHighlight',

    addAttributes() {
        return {
            value: {
                default: null,
                parseHTML: (element) =>
                    element.getAttribute('data-highlight') ??
                    toHexColor(element.style.backgroundColor ?? ''),
                renderHTML: (attributes) => {
                    const value = attributes['value'];
                    if (typeof value !== 'string' || value === '') return {};
                    return isName(value)
                        ? { 'data-highlight': value }
                        : { style: `background-color: ${value}` };
                }
            }
        };
    },

    parseHTML() {
        return [{ tag: 'mark' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['mark', mergeAttributes(HTMLAttributes), 0];
    },

    addCommands() {
        return {
            setHighlight:
                (value) =>
                ({ commands }) =>
                    value === null
                        ? commands.unsetMark(this.name)
                        : commands.setMark(this.name, { value })
        };
    }
});

/**
 * Builds one of the two typographic span marks — typeface and relative size.
 *
 * **Roles and steps, not a font menu and a point picker.** `serif` is something
 * any consumer can honour with its own stack where `Helvetica Neue` is a guess
 * about a machine this editor has never seen, and `large` survives a phone
 * where `18pt` does not. Both defaults mean *no mark*, so a run set and then
 * reset carries no markup at all.
 */
function typographyMark(name: string, attribute: string) {
    return Mark.create({
        name,

        addAttributes() {
            return {
                value: {
                    default: null,
                    parseHTML: (element) => element.getAttribute(attribute),
                    renderHTML: (attributes) =>
                        attributes['value']
                            ? { [attribute]: attributes['value'] }
                            : {}
                }
            };
        },

        parseHTML() {
            return [{ tag: `span[${attribute}]` }];
        },

        renderHTML({ HTMLAttributes }) {
            return ['span', mergeAttributes(HTMLAttributes), 0];
        }
    });
}

/** The typeface a run is set in — `<span data-font="serif">`. */
export const FontRole = typographyMark('fontRole', 'data-font').extend({
    addCommands() {
        return {
            setFontRole:
                (value: string | null) =>
                ({ commands }) =>
                    value === null
                        ? commands.unsetMark('fontRole')
                        : commands.setMark('fontRole', { value })
        };
    }
});

/** A run's size relative to its surroundings — `<span data-text-size="large">`. */
export const TextSize = typographyMark('textSize', 'data-text-size').extend({
    addCommands() {
        return {
            setTextSize:
                (value: string | null) =>
                ({ commands }) =>
                    value === null
                        ? commands.unsetMark('textSize')
                        : commands.setMark('textSize', { value })
        };
    }
});
