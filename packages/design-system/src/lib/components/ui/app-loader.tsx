import { Logo } from './logo';
import { Spinner } from './spinner';
import { cn } from '../../utils';

/**
 * Props for the {@link AppLoader} component.
 */
type AppLoaderProps = React.ComponentProps<'div'> & {
    /**
     * The announced loading text shown beside the spinner. Defaults to
     * `'Loading…'`; callers in a localized tree should pass a translated
     * string (the design system stays intl-agnostic).
     */
    label?: string;
};

/**
 * Branded full-screen boot loader: the large Ortha CMS mark over a spinner and
 * a short status line, centered on the muted background. Used for the "root"
 * load — the initial app boot and the auth probe — where there is no page
 * chrome yet to drape a skeleton over. The whole block is a single
 * `role="status"` region so the busy state announces once; the spinner is
 * decorative (`aria-hidden`) and the `label` carries the announcement.
 */
export function AppLoader({
    label = 'Loading…',
    className,
    ...props
}: AppLoaderProps) {
    return (
        <div
            role="status"
            className={cn(
                'flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10',
                className
            )}
            {...props}
        >
            <Logo size="lg" showLabel={false} />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner aria-hidden />
                <span>{label}</span>
            </div>
        </div>
    );
}
