import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../utils';

const alertVariants = cva(
    'relative w-full rounded-lg border px-4 py-3 text-sm [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7',
    {
        variants: {
            variant: {
                default: 'bg-background text-foreground',
                destructive:
                    'border-destructive/30 bg-destructive-soft text-destructive-soft-foreground [&>svg]:text-destructive',
                /* Tinted callouts matching the soft Badge variants. */
                success:
                    'border-success/30 bg-success-soft text-success-soft-foreground [&>svg]:text-success',
                warning:
                    'border-warning/30 bg-warning-soft text-warning-soft-foreground [&>svg]:text-warning',
                info: 'border-info/30 bg-info-soft text-info-soft-foreground [&>svg]:text-info'
            }
        },
        defaultVariants: {
            variant: 'default'
        }
    }
);

/**
 * Carries the id `Alert` minted for its title down to {@link AlertTitle}, so the
 * banner can name itself without either component needing an id from the caller.
 * `null` outside an `Alert` — a bare `AlertTitle` then renders unlabelled rather
 * than pointing `aria-labelledby` at nothing.
 */
const AlertTitleIdContext = React.createContext<string | null>(null);

/**
 * A page-level message banner. `role="alert"`, so new content is announced.
 *
 * It names itself with `aria-labelledby` pointing at its {@link AlertTitle},
 * rather than the title being a heading. An alert's title is not a section of
 * the document — it is a status message, and the heading rank it should carry
 * depends entirely on where the banner is mounted, which the component cannot
 * know. It used to hardcode `<h5>`, so every banner rendered under a page's
 * `<h1>` jumped four levels and told a screen-reader user it was subordinate to
 * something that does not exist (`ORT-168`).
 */
const Alert = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => {
    const titleId = React.useId();

    return (
        <AlertTitleIdContext.Provider value={titleId}>
            <div
                ref={ref}
                role="alert"
                // A caller that names the banner itself wins: `{...props}` is
                // spread after, so an explicit `aria-label`/`aria-labelledby`
                // overrides this one.
                aria-labelledby={titleId}
                className={cn(alertVariants({ variant }), className)}
                {...props}
            />
        </AlertTitleIdContext.Provider>
    );
});
Alert.displayName = 'Alert';

/**
 * The banner's title line — the text that becomes its accessible name.
 *
 * A `<div>`, not a heading: see {@link Alert}. Consumers that genuinely want a
 * heading here (a banner that really is a titled section) should render one
 * themselves at the rank their page calls for and pass it as a child.
 */
const AlertTitle = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, id, ...props }, ref) => {
    const contextId = React.useContext(AlertTitleIdContext);

    return (
        <div
            ref={ref}
            id={id ?? contextId ?? undefined}
            data-slot="alert-title"
            className={cn(
                'mb-1 font-medium leading-none tracking-tight',
                className
            )}
            {...props}
        />
    );
});
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn('text-sm [&_p]:leading-relaxed', className)}
        {...props}
    />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
