import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Router state a gated `<Navigate>` carries to the page it lands on, so the
 * destination can explain why the user is not where they asked to be.
 */
export type RedirectNoticeState = {
    /** Discriminator for the refusal; the destination owns the copy. */
    redirectNotice?: string;
};

/** The shell's `<main>`, which is already `tabIndex={-1}` for the skip link. */
const MAIN_CONTENT_ID = 'main-content';

/**
 * Handles the arrival half of a permission redirect.
 *
 * A `<Navigate replace>` swaps the page without moving focus or saying
 * anything: focus stays on `<body>`, so the next Tab restarts at the very top
 * of the document — above the whole sidebar — and a screen-reader user hears
 * silence and has to explore to work out where they ended up. This is the SPA
 * analogue of a silent redirect.
 *
 * On arrival it moves focus to the shell's `<main>` (already focusable for the
 * skip link, so no new markup is needed) and returns the notice key once, for
 * the caller to render in a `role="status"` region. The router state is then
 * cleared so a reload or a Back/Forward doesn't replay the announcement.
 */
export function useRedirectNotice(): string | null {
    const location = useLocation();
    const navigate = useNavigate();
    const incoming =
        (location.state as RedirectNoticeState | null)?.redirectNotice ?? null;
    const [notice, setNotice] = useState<string | null>(incoming);

    useEffect(() => {
        if (!incoming) return;

        setNotice(incoming);
        document.getElementById(MAIN_CONTENT_ID)?.focus();

        // Drop the state so the message is a one-shot: it explains *this*
        // navigation, not every later visit to the same URL.
        navigate(location.pathname + location.search, {
            replace: true,
            state: null
        });
    }, [incoming, location.pathname, location.search, navigate]);

    return notice;
}
