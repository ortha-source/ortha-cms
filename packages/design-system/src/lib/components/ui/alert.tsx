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
 * What `Alert` hands down to {@link AlertTitle}: the id it minted, and the
 * callback the title uses to say it exists.
 *
 * The second half is load-bearing. Not every `Alert` has a title — several
 * render only an `AlertDescription` — and `aria-labelledby` pointing at an id
 * that is on no element is an `aria-valid-attr-value` failure, i.e. strictly
 * worse than the unnamed banner it replaced. So the attribute is only written
 * once a title has actually mounted.
 *
 * `null` outside an `Alert`: a bare `AlertTitle` then renders without an id
 * rather than colliding with one it was never given.
 */
const AlertTitleContext = React.createContext<{
    id: string;
    onMount: () => void;
} | null>(null);

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
    const [hasTitle, setHasTitle] = React.useState(false);

    const context = React.useMemo(
        () => ({ id: titleId, onMount: () => setHasTitle(true) }),
        [titleId]
    );

    return (
        <AlertTitleContext.Provider value={context}>
            <div
                ref={ref}
                role="alert"
                // Only once a title exists to point at — see the context above.
                // A caller that names the banner itself wins either way:
                // `{...props}` is spread after, so an explicit
                // `aria-label`/`aria-labelledby` overrides this one.
                aria-labelledby={hasTitle ? titleId : undefined}
                className={cn(alertVariants({ variant }), className)}
                {...props}
            />
        </AlertTitleContext.Provider>
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
    const context = React.useContext(AlertTitleContext);
    const onMount = context?.onMount;

    // Tells the `Alert` above it that there is something to name it with.
    // In an effect rather than during render, because it sets state on the
    // parent.
    React.useEffect(() => {
        onMount?.();
    }, [onMount]);

    return (
        <div
            ref={ref}
            id={id ?? context?.id}
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
