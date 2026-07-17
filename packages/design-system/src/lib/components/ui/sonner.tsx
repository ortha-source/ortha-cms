import { Toaster as Sonner, toast } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * True when a click landed on a toast's body — not on one of its interactive
 * children (close/action/cancel buttons, links), which own their behavior.
 */
function isToastBodyClick(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    if (!target.closest('[data-sonner-toast]')) return false;
    return !target.closest(
        '[data-close-button], [data-action], [data-cancel], a, button'
    );
}

/**
 * App-wide toast host, pinned to the **top-right**. Typed toasts
 * (`toast.success` / `.error` / `.warning` / `.info`) render on the matching
 * soft semantic surface with same-hue text and icon; each toast carries a
 * close button, and clicking a toast's body dismisses it too. The admin is
 * light-only (no theme provider), so the theme is fixed rather than read from
 * `next-themes`. Mounted once by the host in `createAdmin`; call `toast()`
 * from anywhere to surface a notification.
 */
const Toaster = ({ ...props }: ToasterProps) => {
    return (
        /* Sonner renders its toasts in place (no portal), so a wrapper click
           listener can offer press-to-dismiss. Sonner doesn't expose a toast
           id in the DOM, so this dismisses the (rarely more than one) visible
           stack. */
        <div
            onClick={(event) => {
                if (isToastBodyClick(event.target)) toast.dismiss();
            }}
        >
            <Sonner
                theme="light"
                position="top-right"
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
