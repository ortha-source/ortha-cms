/**
 * Classes that lay an `Alert` with a leading icon out as a row instead of the
 * design system's absolutely-positioned icon. That default is tuned for an
 * alert with an `AlertTitle`; with a description alone, its icon sits a few
 * pixels below a one-line message and the text is nudged up, so the callout
 * reads crooked. As a flex row the icon stays on the first line's centre
 * (`mt-0.5` on a 16px icon against a 20px line), whether the text is one line
 * or wraps. Pair with {@link CALLOUT_ICON_CLASS} on the icon.
 */
export const CALLOUT_ALERT_CLASS =
    'flex items-start gap-2.5 [&>svg]:!static [&>svg~*]:!pl-0 [&>svg+div]:!translate-y-0';

/** The icon half of {@link CALLOUT_ALERT_CLASS}. */
export const CALLOUT_ICON_CLASS = 'mt-0.5 size-4 shrink-0';
