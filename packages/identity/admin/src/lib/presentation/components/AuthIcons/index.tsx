import type { ReactNode, SVGProps } from 'react';

/**
 * The handful of line icons the public auth screens draw — the eye on a
 * password field, the status mark on a dead-link card, the arrow back to
 * sign-in.
 *
 * Inline rather than imported from `lucide-react`: this package does not
 * declare that dependency, and the screens need eight glyphs. The path data is
 * Lucide's (ISC), so they sit beside the icons the rest of the admin draws
 * without a visible seam.
 *
 * Every icon is decorative — `aria-hidden` and unfocusable. Whatever it means
 * is said in text next to it, or in the accessible name of the control that
 * holds it.
 */
type IconProps = SVGProps<SVGSVGElement>;

function Icon({
    children,
    className,
    ...props
}: IconProps & { children: ReactNode }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
            className={className ?? 'size-4'}
            {...props}
        >
            {children}
        </svg>
    );
}

/** An open eye — "show the password". */
export function EyeIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
            <circle cx="12" cy="12" r="3" />
        </Icon>
    );
}

/** A struck-through eye — "hide the password". */
export function EyeOffIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
            <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
            <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
            <path d="m2 2 20 20" />
        </Icon>
    );
}

/** A circled "i" — the mark on an informational callout. */
export function InfoIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
        </Icon>
    );
}

/** A left arrow — "back to sign in". */
export function ArrowLeftIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
        </Icon>
    );
}

/** A tick — the "done" mark. */
export function CheckIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M20 6 9 17l-5-5" />
        </Icon>
    );
}

/** A clock — "this link has run out of time". */
export function ClockIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
        </Icon>
    );
}

/** A broken chain link — "this link is not complete". */
export function UnlinkIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71" />
            <path d="m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71" />
            <line x1="8" x2="8" y1="2" y2="5" />
            <line x1="2" x2="5" y1="8" y2="8" />
            <line x1="16" x2="16" y1="19" y2="22" />
            <line x1="19" x2="22" y1="16" y2="16" />
        </Icon>
    );
}

/** A key — a single sign-on provider's button. */
export function KeyIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" />
            <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
        </Icon>
    );
}

/** An envelope with a tick — "a message is on its way". */
export function MailCheckIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            <path d="m16 19 2 2 4-4" />
        </Icon>
    );
}

/** A person with a plus — "you have been invited". */
export function UserPlusIcon(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" x2="19" y1="8" y2="14" />
            <line x1="22" x2="16" y1="11" y2="11" />
        </Icon>
    );
}
