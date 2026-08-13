import { useEffect, useRef, type ReactNode } from 'react';
import { Logo } from '@ortha-cms/design-system';

/**
 * Props for the {@link AuthLayout} component.
 */
type AuthLayoutProps = {
    /** Content rendered inside the centered column (Card, footer, etc.). */
    children: ReactNode;
    /**
     * Identifies which auth surface is showing (`'signin'`, `'invite-form'`,
     * `'invite-dead-link'`, …). Changing it moves focus to the new screen's
     * heading. It is a prop rather than something inferred from `children`
     * because these screens swap *inside* one layout instance: the accept-invite
     * page renders a skeleton, then a form or one of two failure cards, and
     * React keeps the same `AuthLayout` mounted throughout — so nothing about
     * this component's own lifecycle marks the moment the user arrived
     * somewhere new.
     */
    surface: string;
};

/**
 * Reusable centered page wrapper for authentication screens.
 * Provides the muted background, vertical/horizontal centering,
 * logo, and a max-width column. Each page owns its own Card and footer.
 *
 * It also owns **focus on arrival**. These screens are reached by client-side
 * transitions the browser does not treat as navigations — the auth gate
 * redirecting a expired session to sign-in, or the invite lookup resolving —
 * after which focus stays on `<body>` (or on a control that no longer exists)
 * and nothing announces the change. A keyboard user resumes tabbing from the
 * top of a page they were never told they had reached; a screen-reader user
 * discovers it only on hitting a field labelled "Email". Moving focus to the
 * new heading names the page and puts the first control one Tab away.
 */
export function AuthLayout({ children, surface }: AuthLayoutProps) {
    const columnRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const heading = columnRef.current?.querySelector('h1');
        if (!heading) {
            // The busy state is a skeleton with no heading — it already
            // announces itself through its `role="status"` region, and stealing
            // focus mid-load would only move the user somewhere that is about to
            // be replaced.
            return;
        }

        // A heading is not focusable by default; `-1` makes it a programmatic
        // target without adding a tab stop. Set here rather than on each of the
        // five headings so a new auth screen inherits the behaviour by being
        // rendered inside this layout.
        heading.setAttribute('tabindex', '-1');

        // …and suppress the focus ring the browser would draw around it.
        // Chrome treats this programmatic focus as `:focus-visible` and paints
        // its default outline, which puts a box around the page title — it reads
        // as an interactive control the user is expected to do something with,
        // when it is only a reading position.
        //
        // Safe to remove *here specifically*, and nowhere else: 2.4.7 Focus
        // Visible is about elements reachable by keyboard, and `tabindex="-1"`
        // keeps this out of the tab order entirely, so no one can navigate onto
        // it and need the indicator. The announcement is the feedback.
        heading.style.outline = 'none';
        heading.focus();
    }, [surface]);

    return (
        <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
            <div
                ref={columnRef}
                className="flex w-full max-w-sm flex-col gap-6"
            >
                <Logo className="self-center" />
                {children}
            </div>
        </div>
    );
}
