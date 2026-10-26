import { useEffect, useRef, type ReactNode } from 'react';
import { Logo, cn } from '@orthacms/design-system';

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
    /**
     * Whether arriving on this surface should move focus to its `<h1>`.
     * Defaults to `true`.
     *
     * A busy surface passes `false`. The skeletons grew an `<h1>` of their own
     * under `ORT-167` (a loading state with no heading is the state a slow
     * connection sits in longest), and without this the focus move below would
     * start finding it — landing the user on a heading that is about to be
     * unmounted and replaced by the real page's, which is the one case this
     * layout deliberately never took focus for.
     */
    focusHeading?: boolean;
    /**
     * The column's width: `default` (400px) for sign-in and the one-field
     * screens, `wide` (440px) for accepting an invitation, whose name and
     * email sit side by side.
     */
    width?: 'default' | 'wide';
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
export function AuthLayout({
    children,
    surface,
    focusHeading = true,
    width = 'default'
}: AuthLayoutProps) {
    const columnRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!focusHeading) return;

        const heading = columnRef.current?.querySelector('h1');
        if (!heading) {
            // Nothing to land on. A busy state already announces itself through
            // its `role="status"` region, and stealing focus mid-load would only
            // move the user somewhere that is about to be replaced.
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
    }, [surface, focusHeading]);

    return (
        // A `<main>` rather than a `<div>`: the signed-out shell had no landmark
        // at all, so every one of these screens put its whole content outside
        // the structure a screen-reader user navigates by — no "main content" to
        // jump to, and `region` firing on everything on the page. The
        // authenticated side gets its landmark from the shell's `SidebarInset`;
        // these routes mount as top-level siblings of that layout and so have to
        // bring their own (`ORT-166`). It wraps the centering wrapper, not the
        // inner column, so the brand mark is inside the landmark too and nothing
        // is left over for `region` to report.
        <main className="flex min-h-svh flex-col items-center justify-center bg-muted/40 p-4 md:p-10">
            <div
                ref={columnRef}
                className={cn(
                    'flex w-full flex-col gap-5',
                    width === 'wide' ? 'max-w-[440px]' : 'max-w-[400px]'
                )}
            >
                <Logo className="self-center text-[15px] font-semibold" />
                {children}
            </div>
        </main>
    );
}
