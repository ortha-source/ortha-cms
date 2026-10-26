import { Alert, AlertDescription } from '@orthacms/design-system';
import { InfoIcon } from '../AuthIcons';

/** Props for the {@link AuthNotice} component. */
type AuthNoticeProps = {
    /** The user-facing explanation. */
    message: string;
    /** An id, so the screen's heading can point `aria-describedby` at it. */
    id?: string;
};

/**
 * The standing explanation of **how the visitor got to this screen** — today,
 * that the session they were using ended underneath them and the app replaced
 * the page they were on.
 *
 * Deliberately not {@link AuthAlert}, and the differences are the point:
 *
 * - **It does not take focus.** `AuthLayout` has already moved focus to the
 *   screen's `<h1>` on arrival, which is the right landing place; a second
 *   focus move on the same mount would fight it, and the two effects would race
 *   on ordering (a child's runs first, so the layout would win anyway and the
 *   notice would be skipped past). It opens the card, above the heading (R7),
 *   and the heading names it with `aria-describedby` — so it is read as part
 *   of the heading the visitor was placed on, not left behind them.
 * - **It is not destructive.** Nothing the visitor just did failed. It is the
 *   `info` callout, and it sits **above** the heading, as the first thing the
 *   card says — it explains the whole screen, not one field on it.
 *
 * `Alert` carries `role="alert"`, so it is announced if it appears while the
 * page is already up. Mounted at arrival it is usually the focused heading's
 * neighbour rather than a live update — the announcement for that case is the
 * toast `AuthProvider` fires, which reaches the visitor before this page is
 * even mounted.
 */
export function AuthNotice({ message, id }: AuthNoticeProps) {
    return (
        <Alert
            id={id}
            variant="info"
            className="rounded-[10px] border-0 px-3 py-2.5 text-[13px] leading-[18px] [&>svg]:left-3 [&>svg]:top-3 [&>svg~*]:pl-6"
        >
            <InfoIcon />
            <AlertDescription className="text-[13px]">
                {message}
            </AlertDescription>
        </Alert>
    );
}
