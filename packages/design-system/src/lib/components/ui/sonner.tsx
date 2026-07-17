import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * App-wide toast host. The admin is light-only (no theme provider), so the
 * theme is fixed rather than read from `next-themes`. Mounted once by the host
 * in `createAdmin`; call `toast()` from anywhere to surface a notification.
 */
const Toaster = ({ ...props }: ToasterProps) => {
    return (
        <Sonner
            theme="light"
            className="toaster group"
            toastOptions={{
                classNames: {
                    toast: 'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
                    /* Typed toasts pick up the soft semantic surfaces. `!` is
                       needed because the base `toast` classes above also match
                       and stylesheet order between the two is unspecified. */
                    success:
                        'group-[.toaster]:!bg-success-soft group-[.toaster]:!text-success-soft-foreground group-[.toaster]:!border-success/30',
                    error: 'group-[.toaster]:!bg-destructive-soft group-[.toaster]:!text-destructive-soft-foreground group-[.toaster]:!border-destructive/30',
                    warning:
                        'group-[.toaster]:!bg-warning-soft group-[.toaster]:!text-warning-soft-foreground group-[.toaster]:!border-warning/30',
                    info: 'group-[.toaster]:!bg-info-soft group-[.toaster]:!text-info-soft-foreground group-[.toaster]:!border-info/30',
                    description: 'group-[.toast]:text-muted-foreground',
                    actionButton:
                        'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
                    cancelButton:
                        'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground'
                }
            }}
            {...props}
        />
    );
};

export { Toaster };
