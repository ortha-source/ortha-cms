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

/** Classes that style a subtree of stored wysiwyg HTML. */
export const WYSIWYG_PROSE = [
    // Headings — the same scale the editor's HeadingBlock renders.
    '[&_h1]:mt-6 [&_h1]:mb-1 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight',
    '[&_h2]:mt-5 [&_h2]:mb-1 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight',
    '[&_h3]:mt-4 [&_h3]:mb-1 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:tracking-tight',
    '[&_h4]:mt-3 [&_h4]:mb-1 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:tracking-tight',
    '[&_:is(h1,h2,h3,h4):first-child]:mt-0',
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
    '[&_th]:bg-muted/50 [&_th]:text-left [&_th]:font-semibold',
    // Media and layout.
    '[&_figure]:my-2',
    '[&_img]:border-border [&_img]:max-h-96 [&_img]:rounded-md [&_img]:border',
    '[&_figcaption]:text-muted-foreground [&_figcaption]:text-sm',
    '[&_details]:my-1 [&_summary]:cursor-pointer [&_summary]:font-medium',
    '[&_div[data-block=columns]]:flex [&_div[data-block=columns]]:flex-col [&_div[data-block=columns]]:gap-3 sm:[&_div[data-block=columns]]:flex-row',
    '[&_div[data-block=column]]:min-w-0 [&_div[data-block=column]]:flex-1'
].join(' ');
