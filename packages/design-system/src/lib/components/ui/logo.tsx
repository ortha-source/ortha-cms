import { HexagonIcon } from 'lucide-react';
import { cn } from '../../utils';

/**
 * Props for the {@link Logo} component.
 */
type LogoProps = React.ComponentProps<'div'> & {
    /** Whether to show the "Ortha CMS" text label. Defaults to true. */
    showLabel?: boolean;
};

/**
 * Ortha CMS brand logo. Renders the hexagon icon badge
 * with an optional text label.
 */
export function Logo({ className, showLabel = true, ...props }: LogoProps) {
    return (
        <div
            className={cn('flex items-center gap-2 font-medium', className)}
            {...props}
        >
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <HexagonIcon className="size-4" aria-hidden="true" />
            </div>
            {showLabel ? (
                <span>Ortha CMS</span>
            ) : (
                <span className="sr-only">Ortha CMS</span>
            )}
        </div>
    );
}
