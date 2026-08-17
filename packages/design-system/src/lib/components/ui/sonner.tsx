import { Toaster as Sonner, toast } from 'sonner';
import { useAppearance } from '../../appearance';

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * The toast a click landed on, if it landed on that toast's **body** — not on
 * one of its interactive children (close/action/cancel buttons, links), which
 * own their behavior.
 */
function toastBodyOf(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof HTMLElement)) return null;
    const toastElement = target.closest<HTMLElement>('[data-sonner-toast]');
    if (!toastElement) return null;
    return target.closest(
        '[data-close-button], [data-action], [data-cancel], a, button'
    )
        ? null
        : toastElement;
}

/**
 * Dismisses the one toast that was clicked.
 *
 * Sonner exposes no toast id in the DOM, and `toast.dismiss()` with no id means
 * *dismiss everything* — so press-to-dismiss used to take the whole visible
 * stack, including toasts the user had not read yet. Each toast does render its
 * own close button, though, so the clicked toast can be made to dismiss itself.
 * If a consumer has turned the close button off, fall back to the old
 * behaviour rather than leaving the press dead.
 */
function dismissToast(toastElement: HTMLElement): void {
    const closeButton = toastElement.querySelector<HTMLElement>(
        '[data-close-button]'
    );
    if (closeButton) {
        closeButton.click();
        return;
    }
    toast.dismiss();
}

/**
 * App-wide toast host, pinned to the **bottom-right**. Typed toasts
 * (`toast.success` / `.error` / `.warning` / `.info`) render on the matching
 * soft semantic surface with same-hue text and icon; each toast carries a
 * close button, and clicking a toast's body dismisses **that** toast too. The
 * close button is what makes the press-to-dismiss per-toast, so turning it off
 * from a consumer degrades the press back to dismissing the stack. The toast surface
 * follows the app theme — the resolved `light`/`dark` from `useAppearance` is
 * handed to Sonner so its own chrome matches the admin. Mounted once by the host
 * in `createAdmin`; call `toast()` from anywhere to surface a notification.
 *
 * The corner is settled **here**, not at the call site. It used to be declared
 * in both places and disagree — this doc said top-right while the host passed
 * `position="bottom-right"`, and `{...props}` is spread last, so the host won
 * and the documentation was simply wrong. Bottom-right is the real answer:
 * `copilot-admin` reasons about it (it suppresses a toast while its bottom-right
 * dock is open, because one would cover the composer to announce something
 * already on screen), so moving the toasts would silently invalidate that.
 * Overriding `position` from a consumer is therefore a change to a shared
 * decision, not a local one.
 */
const Toaster = ({ ...props }: ToasterProps) => {
    const { resolvedTheme } = useAppearance();
    return (
        /* Sonner renders its toasts in place (no portal), so a wrapper click
           listener can offer press-to-dismiss — of the toast that was pressed,
           and only that one. */
        <div
            onClick={(event) => {
                const pressed = toastBodyOf(event.target);
                if (pressed) dismissToast(pressed);
            }}
        >
            <Sonner
                theme={resolvedTheme}
                position="bottom-right"
                closeButton
                className="toaster group"
                toastOptions={{
                    classNames: {
                        toast: 'group toast cursor-pointer group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
                        /* Typed toasts pick up the soft semantic surfaces. The
                           trailing `!` (Tailwind v4 important) outranks the
                           base `toast` classes above, whose stylesheet order
                           vs these is unspecified. */
                        success:
                            'group-[.toaster]:bg-success-soft! group-[.toaster]:text-success-soft-foreground! group-[.toaster]:border-success/30!',
                        error: 'group-[.toaster]:bg-destructive-soft! group-[.toaster]:text-destructive-soft-foreground! group-[.toaster]:border-destructive/30!',
                        warning:
                            'group-[.toaster]:bg-warning-soft! group-[.toaster]:text-warning-soft-foreground! group-[.toaster]:border-warning/30!',
                        info: 'group-[.toaster]:bg-info-soft! group-[.toaster]:text-info-soft-foreground! group-[.toaster]:border-info/30!',
                        description: 'group-[.toast]:text-muted-foreground',
                        actionButton:
                            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
                        cancelButton:
                            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
                        closeButton:
                            'group-[.toast]:border-border group-[.toast]:bg-card group-[.toast]:text-foreground'
                    }
                }}
                {...props}
            />
        </div>
    );
};

export { Toaster };
