/**
 * What an image's `alt` and `decorative` attributes may be **together**.
 *
 * The two describe one decision, and one of their four combinations is a
 * defect: a non-empty `alt` beside `data-decorative` is announced by a screen
 * reader on an image the author declared has nothing to announce. The popover
 * disables its input while the box is ticked rather than emptying it — so that
 * the two choices stay visible as one — which means the text is still in the
 * draft when Save is pressed, and something has to drop it.
 *
 * It lives here, framework-free, because more than one path writes these
 * attributes: the node view saves the popover's answer, and the `setMediaAlt`
 * command is the same edit made from a keybinding or a script. A rule spelled
 * out at only one of them is a rule the other silently breaks.
 */
export function mediaAltAttributes({
    alt,
    decorative
}: {
    alt: string;
    decorative: boolean;
}): { alt: string; decorative: boolean } {
    // Decorative wins over whatever is in the box: the author's last answer to
    // "what does this picture say?" was "nothing".
    return { alt: decorative ? '' : alt, decorative };
}
