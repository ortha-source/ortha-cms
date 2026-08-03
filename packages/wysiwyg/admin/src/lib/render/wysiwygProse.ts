/**
 * Typography for **rendered** (non-editing) wysiwyg HTML.
 *
 * The editor styles each block through its own React renderer; a stored value
 * dropped into the DOM as markup has no renderers, so it needs the same look
 * expressed as CSS. This is that one definition — used by the preview card and
 * by {@link WysiwygContent}, and exported so a consumer rendering the delivered
 * HTML can reach for the same styling instead of inventing a second one.
 *
 * Written as Tailwind child-selector utilities rather than a plugin so it
 * inherits the design system's tokens (and therefore dark mode) for free.
 */

/**
 * The palette, as design-system classes. One map per mark, keyed by the stored
 * colour name — the single place a name becomes a colour, so the swatch in the
 * picker, the text in the editor and the rendered document cannot disagree.
 *
 * Tailwind's own scale rather than raw hex, so the palette follows the theme
 * into dark mode instead of burning ten light-mode colours into the app.
 */
export const COLOR_SWATCH: Readonly<Record<string, string>> = {
    default: 'text-foreground',
    gray: 'text-gray-500 dark:text-gray-400',
    brown: 'text-amber-800 dark:text-amber-600',
    orange: 'text-orange-600 dark:text-orange-400',
    yellow: 'text-yellow-600 dark:text-yellow-400',
    green: 'text-emerald-600 dark:text-emerald-400',
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-violet-600 dark:text-violet-400',
    pink: 'text-pink-600 dark:text-pink-400',
    red: 'text-red-600 dark:text-red-400'
};

/** The same palette as backgrounds, for the highlight mark. */
export const HIGHLIGHT_SWATCH: Readonly<Record<string, string>> = {
    default: 'bg-muted',
    gray: 'bg-gray-500/20',
    brown: 'bg-amber-800/20',
    orange: 'bg-orange-500/25',
    yellow: 'bg-yellow-400/35',
    green: 'bg-emerald-500/25',
    blue: 'bg-blue-500/25',
    purple: 'bg-violet-500/25',
    pink: 'bg-pink-500/25',
    red: 'bg-red-500/25'
};

/**
 * The typefaces, as design-system classes — one place a role name becomes a
 * font stack, shared by the picker, the editor and the rendered document.
 */
export const FONT_CLASS: Readonly<Record<string, string>> = {
    default: '',
    sans: 'font-sans',
    serif: 'font-serif',
    mono: 'font-mono'
};

/** The relative sizes, as classes. Steps against the surrounding text. */
export const TEXT_SIZE_CLASS: Readonly<Record<string, string>> = {
    normal: '',
    small: 'text-[0.85em]',
    large: 'text-[1.25em]',
    huge: 'text-[1.6em]'
};

/**
 * The **inline** half of the styling: the marks that live inside a block's own
 * HTML rather than on the block.
 *
 * Split out because the editor needs it too. Block styling in the editor comes
 * from each React renderer, so the editor does not want `WYSIWYG_PROSE` — but a
 * colour lives in the markup `InlineEditable` renders verbatim, and without
 * these rules an author picked a colour and watched nothing happen.
 */
export const WYSIWYG_INLINE_PROSE: readonly string[] = [
    // Colour and highlight, keyed by the palette names the sanitizer pins
    // `data-color` / `data-highlight` to.
    '[&_[data-color=gray]]:text-gray-500 dark:[&_[data-color=gray]]:text-gray-400',
    '[&_[data-color=brown]]:text-amber-800 dark:[&_[data-color=brown]]:text-amber-600',
    '[&_[data-color=orange]]:text-orange-600 dark:[&_[data-color=orange]]:text-orange-400',
    '[&_[data-color=yellow]]:text-yellow-600 dark:[&_[data-color=yellow]]:text-yellow-400',
    '[&_[data-color=green]]:text-emerald-600 dark:[&_[data-color=green]]:text-emerald-400',
    '[&_[data-color=blue]]:text-blue-600 dark:[&_[data-color=blue]]:text-blue-400',
    '[&_[data-color=purple]]:text-violet-600 dark:[&_[data-color=purple]]:text-violet-400',
    '[&_[data-color=pink]]:text-pink-600 dark:[&_[data-color=pink]]:text-pink-400',
    '[&_[data-color=red]]:text-red-600 dark:[&_[data-color=red]]:text-red-400',
    // `<mark>` carries a browser default of black-on-yellow; the palette
    // replaces it outright so an unhighlighted theme never leaks through.
    '[&_mark]:bg-transparent [&_mark]:text-inherit [&_mark]:rounded [&_mark]:px-0.5',
    '[&_[data-highlight=gray]]:bg-gray-500/20',
    '[&_[data-highlight=brown]]:bg-amber-800/20',
    '[&_[data-highlight=orange]]:bg-orange-500/25',
    '[&_[data-highlight=yellow]]:bg-yellow-400/35',
    '[&_[data-highlight=green]]:bg-emerald-500/25',
    '[&_[data-highlight=blue]]:bg-blue-500/25',
    '[&_[data-highlight=purple]]:bg-violet-500/25',
    '[&_[data-highlight=pink]]:bg-pink-500/25',
    '[&_[data-highlight=red]]:bg-red-500/25',
    // Typeface and relative size — roles and steps, resolved against whatever
    // the surrounding surface uses rather than pinned to a stack or a point.
    '[&_[data-font=sans]]:font-sans',
    '[&_[data-font=serif]]:font-serif',
    '[&_[data-font=mono]]:font-mono',
    '[&_[data-text-size=small]]:text-[0.85em]',
    '[&_[data-text-size=large]]:text-[1.25em]',
    '[&_[data-text-size=huge]]:text-[1.6em]'
];

/** Classes that style a subtree of stored wysiwyg HTML. */
export const WYSIWYG_PROSE = [
    // Headings — the same scale the editor's HeadingBlock renders.
    '[&_h1]:mt-6 [&_h1]:mb-1 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight',
    '[&_h2]:mt-5 [&_h2]:mb-1 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight',
    '[&_h3]:mt-4 [&_h3]:mb-1 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:tracking-tight',
    '[&_h4]:mt-3 [&_h4]:mb-1 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:tracking-tight',
    '[&_h5]:mt-3 [&_h5]:mb-1 [&_h5]:text-sm [&_h5]:font-semibold [&_h5]:tracking-tight',
    '[&_h6]:text-muted-foreground [&_h6]:mt-3 [&_h6]:mb-1 [&_h6]:text-sm [&_h6]:font-semibold [&_h6]:tracking-wide [&_h6]:uppercase',
    '[&_:is(h1,h2,h3,h4,h5,h6):first-child]:mt-0',
    // Body text and inline marks.
    '[&_p]:py-1 [&_p]:leading-7',
    '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4',
    '[&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]',
    // Lists. The to-do variant drops its marker — the checked state is drawn
    // by the `data-checked` rules below, not by a bullet.
    '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5',
    '[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5',
    '[&_li]:py-0.5 [&_li]:leading-7',
    '[&_ul[data-list=todo]]:list-none [&_ul[data-list=todo]]:pl-1',
    '[&_li[data-checked]]:before:text-muted-foreground [&_li[data-checked]]:before:mr-2 [&_li[data-checked=false]]:before:content-["☐"] [&_li[data-checked=true]]:before:content-["☑"]',
    '[&_li[data-checked=true]]:text-muted-foreground [&_li[data-checked=true]]:line-through',
    // Block containers.
    '[&_blockquote]:border-border [&_blockquote]:my-1 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:italic',
    '[&_pre]:bg-muted/60 [&_pre]:border-border [&_pre]:my-1 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:p-3',
    '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-sm [&_pre_code]:leading-6',
    '[&_hr]:border-border [&_hr]:my-3',
    // Callouts carry their tone in `data-tone`; each maps to the same surface
    // the editor's CalloutBlock draws.
    '[&_aside]:my-1 [&_aside]:rounded-md [&_aside]:border [&_aside]:px-3 [&_aside]:py-2',
    '[&_aside[data-tone=info]]:border-primary/30 [&_aside[data-tone=info]]:bg-primary/5',
    '[&_aside[data-tone=success]]:border-emerald-500/30 [&_aside[data-tone=success]]:bg-emerald-500/5',
    '[&_aside[data-tone=warning]]:border-amber-500/30 [&_aside[data-tone=warning]]:bg-amber-500/5',
    '[&_aside[data-tone=danger]]:border-destructive/30 [&_aside[data-tone=danger]]:bg-destructive/5',
    '[&_aside[data-tone=neutral]]:border-border [&_aside[data-tone=neutral]]:bg-muted/40',
    // Tables. `block` on the table plus `overflow-x-auto` is what keeps a wide
    // table from widening the whole page — a table is the one block whose
    // natural width has nothing to do with its container's.
    '[&_table]:my-2 [&_table]:block [&_table]:w-fit [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-sm',
    '[&_:is(th,td)]:border-border [&_:is(th,td)]:min-w-24 [&_:is(th,td)]:border [&_:is(th,td)]:px-2 [&_:is(th,td)]:py-1 [&_:is(th,td)]:align-top',
    // A column the author dragged to a width carries an inline one, and the
    // floor above would quietly overrule it. `[style]` is enough of a test:
    // width is the only property the sanitizer keeps on a cell.
    '[&_:is(th,td)[style]]:min-w-0',
    // `:not([data-align])` rather than plain `[&_th]`, because a header cell the
    // author centred has to beat the header's own default — and Tailwind orders
    // its output by utility, not by the order these are written in, so equal
    // specificity would leave which one wins to the build.
    '[&_th]:bg-muted/50 [&_th]:font-semibold [&_th:not([data-align])]:text-left',
    // Vertical alignment. `top` is the default above and is never written.
    '[&_:is(th,td)[data-valign=middle]]:align-middle',
    '[&_:is(th,td)[data-valign=bottom]]:align-bottom',
    // Aligning the **table** moves the box, so it is margins rather than
    // `text-align` — same reason as the figure below, and it works here only
    // because the table is `block w-fit` and so has a width to be pushed
    // around. A table whose columns were resized is `width: 100%` inline and
    // has nowhere left to move, which is the honest outcome of asking for both.
    //
    // The `text-start` is not redundant: `data-align` is one attribute with one
    // generic rule, and without this the table's own alignment would inherit
    // down and centre every cell's text — two choices the editor deliberately
    // keeps apart. It wins on specificity rather than on order (a tag name
    // outranks the bare attribute selector), so the build cannot reshuffle it.
    '[&_table[data-align]]:text-start',
    '[&_table[data-align=center]]:mx-auto',
    '[&_table[data-align=right]]:mr-0 [&_table[data-align=right]]:ml-auto',
    // Alignment. One rule for every alignable tag — the attribute is the
    // contract, so a consumer styling the delivered HTML writes the same four
    // selectors and gets the same result.
    '[&_[data-align=center]]:text-center',
    '[&_[data-align=right]]:text-right',
    '[&_[data-align=justify]]:text-justify',
    // Centring a figure has to move the **picture**, and `text-align` cannot:
    // the reset makes `<img>` a block, and a block box ignores it. So the
    // margins do it — on the figure (which the size presets give a width) and
    // on the image inside it (which is only as wide as it is).
    '[&_figure[data-align=center]]:mx-auto [&_figure[data-align=right]]:ml-auto',
    '[&_figure[data-align=center]_img]:mx-auto [&_figure[data-align=right]_img]:ml-auto',
    ...WYSIWYG_INLINE_PROSE,
    // Media and layout.
    '[&_figure]:my-2',
    // Image width presets. Percentages of the measure rather than pixels: the
    // stored HTML renders on a surface whose width this editor never sees.
    '[&_figure[data-size=small]]:w-1/3 [&_figure[data-size=medium]]:w-1/2 [&_figure[data-size=large]]:w-3/4',
    '[&_img]:border-border [&_img]:max-h-96 [&_img]:rounded-md [&_img]:border',
    '[&_figcaption]:text-muted-foreground [&_figcaption]:text-sm',
    '[&_details]:my-1 [&_summary]:cursor-pointer [&_summary]:font-medium',
    '[&_div[data-block=columns]]:flex [&_div[data-block=columns]]:flex-col [&_div[data-block=columns]]:gap-3 sm:[&_div[data-block=columns]]:flex-row',
    '[&_div[data-block=column]]:min-w-0 [&_div[data-block=column]]:flex-1'
].join(' ');
